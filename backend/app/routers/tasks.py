from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.models.task import Task, TaskDependency, TaskHistory
from app.schemas.dependency import DependencyCreate, DependencyResponse
from app.schemas.task import (
    TaskCreate,
    TaskHistoryResponse,
    TaskPositionUpdate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.services.task_service import (
    check_dependencies_met,
    has_circular_dependency,
    record_history,
    validate_status_transition,
)

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
    # Verify project exists and is not deleted
    proj = await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
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

    # Dependency check for in_progress transition
    if data.status == "in_progress":
        deps_met, blocking = await check_dependencies_met(db, task_id)
        if not deps_met:
            titles = ", ".join(blocking)
            raise HTTPException(
                status_code=422,
                detail=f"Abhaengigkeiten noch nicht erledigt: {titles}",
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

        # Dependency check for in_progress transition
        if data.status == "in_progress":
            deps_met, blocking = await check_dependencies_met(db, task_id)
            if not deps_met:
                titles = ", ".join(blocking)
                raise HTTPException(
                    status_code=422,
                    detail=f"Abhaengigkeiten noch nicht erledigt: {titles}",
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


# --- Timeline Endpoint ---


@router.get("/api/projects/{project_id}/timeline")
async def get_project_timeline(
    project_id: str,
    include_done: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    """Returns tasks with their dependencies optimized for Gantt chart."""
    query = select(Task).where(Task.project_id == project_id)
    if not include_done:
        query = query.where(Task.status != "done")
    query = query.order_by(Task.sort_order, Task.created_at)
    result = await db.execute(query)
    tasks = result.scalars().all()

    # Get all dependencies for these tasks
    task_ids = [t.id for t in tasks]
    deps_result = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id.in_(task_ids))
    )
    deps = deps_result.scalars().all()

    # Build dependency map
    dep_map: dict[str, list[str]] = {}
    for dep in deps:
        if dep.task_id not in dep_map:
            dep_map[dep.task_id] = []
        dep_map[dep.task_id].append(dep.depends_on_task_id)

    return [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "estimated_duration_minutes": t.estimated_duration_minutes,
            "parent_task_id": t.parent_task_id,
            "dependencies": dep_map.get(t.id, []),
        }
        for t in tasks
    ]


# --- Dependency Endpoints ---


@router.get(
    "/api/tasks/{task_id}/dependencies",
    response_model=list[DependencyResponse],
)
async def list_dependencies(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task nicht gefunden")

    result = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id == task_id)
    )
    deps = result.scalars().all()

    responses = []
    for dep in deps:
        dep_task = await db.get(Task, dep.depends_on_task_id)
        responses.append(
            DependencyResponse(
                task_id=dep.task_id,
                depends_on_task_id=dep.depends_on_task_id,
                depends_on_title=dep_task.title if dep_task else None,
                depends_on_status=dep_task.status if dep_task else None,
            )
        )
    return responses


@router.post(
    "/api/tasks/{task_id}/dependencies",
    response_model=DependencyResponse,
    status_code=201,
)
async def add_dependency(
    task_id: str,
    data: DependencyCreate,
    db: AsyncSession = Depends(get_db),
):
    # Verify both tasks exist
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task nicht gefunden")

    dep_task = await db.get(Task, data.depends_on_task_id)
    if not dep_task:
        raise HTTPException(404, "Abhaengiger Task nicht gefunden")

    # No self-dependency
    if task_id == data.depends_on_task_id:
        raise HTTPException(422, "Task kann nicht von sich selbst abhaengen")

    # No duplicate
    existing = await db.execute(
        select(TaskDependency).where(
            TaskDependency.task_id == task_id,
            TaskDependency.depends_on_task_id == data.depends_on_task_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(422, "Abhaengigkeit existiert bereits")

    # No circular dependency
    if await has_circular_dependency(db, task_id, data.depends_on_task_id):
        raise HTTPException(422, "Zirkulaere Abhaengigkeit erkannt")

    dep = TaskDependency(
        task_id=task_id,
        depends_on_task_id=data.depends_on_task_id,
    )
    db.add(dep)
    await db.commit()

    return DependencyResponse(
        task_id=task_id,
        depends_on_task_id=data.depends_on_task_id,
        depends_on_title=dep_task.title,
        depends_on_status=dep_task.status,
    )


@router.delete(
    "/api/tasks/{task_id}/dependencies/{depends_on_task_id}",
    status_code=204,
)
async def remove_dependency(
    task_id: str,
    depends_on_task_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TaskDependency).where(
            TaskDependency.task_id == task_id,
            TaskDependency.depends_on_task_id == depends_on_task_id,
        )
    )
    dep = result.scalar_one_or_none()
    if not dep:
        raise HTTPException(404, "Abhaengigkeit nicht gefunden")

    await db.delete(dep)
    await db.commit()
