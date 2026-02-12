from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.comment import Comment
from app.models.task import Task
from app.schemas.comment import CommentCreate, CommentResponse

router = APIRouter(prefix="/api", tags=["comments"])


@router.get("/tasks/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    task_id: str, session: AsyncSession = Depends(get_db)
):
    # Verify task exists
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task nicht gefunden")

    result = await session.execute(
        select(Comment)
        .where(Comment.task_id == task_id)
        .order_by(Comment.created_at.asc())
    )
    return result.scalars().all()


@router.post(
    "/tasks/{task_id}/comments",
    response_model=CommentResponse,
    status_code=201,
)
async def create_comment(
    task_id: str,
    data: CommentCreate,
    session: AsyncSession = Depends(get_db),
):
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task nicht gefunden")

    comment = Comment(
        id=str(uuid4()),
        task_id=task_id,
        author_type=data.author_type,
        author_name=data.author_name,
        content=data.content,
    )
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: str, session: AsyncSession = Depends(get_db)
):
    comment = await session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(404, "Kommentar nicht gefunden")

    await session.delete(comment)
    await session.commit()
