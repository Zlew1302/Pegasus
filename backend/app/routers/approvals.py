from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.approval import Approval
from app.models.agent import AgentInstance, AgentType
from app.models.task import Task
from app.models.project import Project
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
    return [
        ApprovalWithContextResponse(
            **ApprovalResponse.model_validate(row[0]).model_dump(),
            task_title=row[1],
            project_id=row[2],
            project_title=row[3],
            agent_type_name=row[4],
            agent_status=row[5],
            progress_percent=row[6],
            current_step=row[7],
            total_steps=row[8],
        )
        for row in rows
    ]


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
