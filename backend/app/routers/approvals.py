from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.approval import Approval
from app.models.agent import AgentInstance, AgentType
from app.models.task import Task
from app.models.project import Project
from app.models.execution import ExecutionStep
from app.models.output import TaskOutput
from app.schemas.approval import ApprovalResolve, ApprovalResponse, ApprovalWithContextResponse
from app.services.agent_service import resume_agent_with_feedback

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalResponse])
async def list_approvals(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Approval).order_by(Approval.requested_at.desc())
    if status:
        query = query.where(Approval.status == status)
    result = await db.execute(query)
    return [ApprovalResponse.model_validate(a) for a in result.scalars().all()]


@router.get("/with-context", response_model=list[ApprovalWithContextResponse])
async def list_approvals_with_context(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List approvals enriched with task, project, and agent context."""
    stmt = (
        select(
            Approval,
            Task.title.label("task_title"),
            Task.project_id.label("project_id"),
            Project.title.label("project_title"),
            AgentType.name.label("agent_type_name"),
            AgentInstance.status.label("agent_status"),
            AgentInstance.progress_percent.label("progress_percent"),
            AgentInstance.current_step.label("current_step"),
            AgentInstance.total_steps.label("total_steps"),
            AgentInstance.thought_log.label("thought_log"),
        )
        .join(Task, Approval.task_id == Task.id)
        .outerjoin(Project, Task.project_id == Project.id)
        .outerjoin(AgentInstance, Approval.agent_instance_id == AgentInstance.id)
        .outerjoin(AgentType, AgentInstance.agent_type_id == AgentType.id)
    )
    if status:
        stmt = stmt.where(Approval.status == status)
    stmt = stmt.order_by(Approval.requested_at.desc())

    result = await db.execute(stmt)
    rows = result.all()

    responses = []
    for row in rows:
        approval_obj = row[0]
        instance_id = approval_obj.agent_instance_id
        task_id = approval_obj.task_id

        # Fetch recent execution steps for this agent instance
        recent_steps: list[dict] = []
        if instance_id:
            steps_result = await db.execute(
                select(ExecutionStep)
                .where(ExecutionStep.agent_instance_id == instance_id)
                .order_by(ExecutionStep.step_number.desc())
                .limit(5)
            )
            recent_steps = [
                {
                    "step_number": s.step_number,
                    "step_type": s.step_type,
                    "description": s.description,
                    "duration_ms": s.duration_ms,
                    "cost_cents": s.cost_cents,
                }
                for s in steps_result.scalars().all()
            ]
            recent_steps.reverse()

        # Fetch latest task output
        task_output_content: str | None = None
        output_result = await db.execute(
            select(TaskOutput.content)
            .where(TaskOutput.task_id == task_id)
            .order_by(TaskOutput.version.desc())
            .limit(1)
        )
        output_row = output_result.scalar_one_or_none()
        if output_row:
            task_output_content = output_row[:2000] if output_row else None

        responses.append(
            ApprovalWithContextResponse(
                **ApprovalResponse.model_validate(approval_obj).model_dump(),
                task_title=row[1],
                project_id=row[2],
                project_title=row[3],
                agent_type_name=row[4],
                agent_status=row[5],
                progress_percent=row[6],
                current_step=row[7],
                total_steps=row[8],
                thought_log=row[9],
                recent_steps=recent_steps,
                task_output_content=task_output_content,
            )
        )

    return responses


@router.get("/{approval_id}", response_model=ApprovalResponse)
async def get_approval(approval_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Approval).where(Approval.id == approval_id)
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval nicht gefunden")
    return ApprovalResponse.model_validate(approval)


@router.post("/{approval_id}/resolve", response_model=ApprovalResponse)
async def resolve_approval(
    approval_id: str,
    data: ApprovalResolve,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Approval).where(Approval.id == approval_id)
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval nicht gefunden")
    if approval.status != "pending":
        raise HTTPException(status_code=422, detail="Approval bereits aufgeloest")

    if data.status not in ("approved", "rejected", "changes_requested"):
        raise HTTPException(status_code=422, detail="Ungueltiger Status")

    approval.status = data.status
    approval.reviewer_comment = data.comment
    approval.resolved_at = datetime.now(UTC)

    # Update task status based on approval resolution
    task_result = await db.execute(
        select(Task).where(Task.id == approval.task_id)
    )
    task = task_result.scalar_one_or_none()
    if task:
        if data.status == "approved":
            task.status = "done"
        elif data.status == "rejected":
            task.status = "todo"
        elif data.status == "changes_requested":
            task.status = "in_progress"

    await db.commit()
    await db.refresh(approval)

    # Trigger agent revision on changes_requested
    if data.status == "changes_requested" and approval.agent_instance_id and data.comment:
        resume_agent_with_feedback(approval.agent_instance_id, data.comment)

    return ApprovalResponse.model_validate(approval)
