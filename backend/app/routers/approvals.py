from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.approval import Approval
from app.models.task import Task
from app.schemas.approval import ApprovalResolve, ApprovalResponse

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
    approval.resolved_at = datetime.utcnow()

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
    return ApprovalResponse.model_validate(approval)
