from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.models.task import Task, TaskHistory
from app.schemas.task import (
    TaskCreate,
    TaskHistoryResponse,
    TaskPositionUpdate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.services.task_service import record_history, validate_status_transition

router = APIRouter(tags=["tasks"])


@router.get("/api/projects/{project_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    project_id: str,
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Task).where(Task.project_id == project_id)
    if status:
        query = query.where(Task.status == status)
    query = query.order_by(Task.sort_order, Task.created_at)
    result = await db.execute(query)
    return [TaskResponse.model_validate(t) for t in result.scalars().all()]


@router.post("/api/projects/{project_id}/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    project_id: str, data: TaskCreate, db: AsyncSession = Depends(get_db)
):
    # Verify project exists
    proj = await db.execute(select(Project).where(Project.id == project_id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    task = Task(id=str(uuid4()), project_id=project_id, **data.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")
    return TaskResponse.model_validate(task)


@router.patch("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str, data: TaskUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")

    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        old_value = getattr(task, key, None)
        if old_value != value:
            await record_history(
                session=db,
                task_id=task_id,
                field_name=key,
                old_value=str(old_value) if old_value is not None else None,
                new_value=str(value) if value is not None else None,
            )
            setattr(task, key, value)

    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")
    await db.delete(task)
    await db.commit()


@router.patch("/api/tasks/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    task_id: str, data: TaskStatusUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")

    if not validate_status_transition(task.status, data.status):
        raise HTTPException(
            status_code=422,
            detail=f"Ungueltiger Statuswechsel: {task.status} -> {data.status}",
        )

    old_status = task.status
    task.status = data.status
    await record_history(
        session=db,
        task_id=task_id,
        field_name="status",
        old_value=old_status,
        new_value=data.status,
    )

    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.patch("/api/tasks/{task_id}/position", response_model=TaskResponse)
async def update_task_position(
    task_id: str, data: TaskPositionUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")

    old_status = task.status
    if old_status != data.status:
        if not validate_status_transition(old_status, data.status):
            raise HTTPException(
                status_code=422,
                detail=f"Ungueltiger Statuswechsel: {old_status} -> {data.status}",
            )
        await record_history(
            session=db,
            task_id=task_id,
            field_name="status",
            old_value=old_status,
            new_value=data.status,
        )
        task.status = data.status

    task.sort_order = data.sort_order
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.get("/api/tasks/{task_id}/history", response_model=list[TaskHistoryResponse])
async def get_task_history(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TaskHistory)
        .where(TaskHistory.task_id == task_id)
        .order_by(TaskHistory.changed_at.desc())
    )
    return [TaskHistoryResponse.model_validate(h) for h in result.scalars().all()]
