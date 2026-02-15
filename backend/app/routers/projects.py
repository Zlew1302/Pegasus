from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.auth import get_current_user
from app.database import get_db
from app.models.project import Project
from app.models.task import Task
from app.pagination import PaginatedResponse, PaginationParams
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=PaginatedResponse[ProjectResponse])
async def list_projects(
    user_id: str = Depends(get_current_user),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    base_filter = (Project.owner_id == user_id) & (Project.deleted_at.is_(None))

    # Total count
    total = await db.scalar(select(func.count()).where(base_filter).select_from(Project))

    # Fetch projects with task count in a single query (no N+1)
    task_count_sq = (
        select(Task.project_id, func.count().label("cnt"))
        .group_by(Task.project_id)
        .subquery()
    )

    result = await db.execute(
        select(Project, func.coalesce(task_count_sq.c.cnt, 0).label("task_count"))
        .outerjoin(task_count_sq, Project.id == task_count_sq.c.project_id)
        .where(base_filter)
        .order_by(Project.updated_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )

    response = []
    for project, task_count in result.all():
        resp = ProjectResponse.model_validate(project)
        resp.task_count = task_count
        response.append(resp)

    return PaginatedResponse(
        items=response,
        total=total or 0,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=(pagination.offset + pagination.limit) < (total or 0),
    )


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(id=str(uuid4()), owner_id=user_id, **data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    count_result = await db.execute(
        select(func.count()).where(Task.project_id == project.id)
    )
    resp = ProjectResponse.model_validate(project)
    resp.task_count = count_result.scalar() or 0
    return resp


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    # Soft-delete: Kosten bleiben über Tasks → AgentInstances → ExecutionSteps erhalten
    project.deleted_at = datetime.now(UTC)
    await db.commit()
