import logging
from datetime import datetime, UTC, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.task_template import TaskTemplate
from app.schemas.template import TemplateCreate, TemplateResponse, TemplateUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/templates", tags=["templates"])


def _compute_next_run(rec_type: str | None, interval: int, rec_day: int | None) -> datetime | None:
    """Berechnet den naechsten Ausfuehrungszeitpunkt."""
    if not rec_type:
        return None
    now = datetime.now(UTC)
    if rec_type == "daily":
        return now + timedelta(days=interval)
    if rec_type == "weekly":
        return now + timedelta(weeks=interval)
    if rec_type == "monthly":
        return now + timedelta(days=30 * interval)
    return None


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(
    project_id: str,
    body: TemplateCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Neue Aufgabenvorlage erstellen."""
    template = TaskTemplate(
        id=str(uuid4()),
        project_id=project_id,
        title=body.title,
        description=body.description,
        priority=body.priority,
        assignee_agent_type_id=body.assignee_agent_type_id,
        recurrence_type=body.recurrence_type,
        recurrence_interval=body.recurrence_interval,
        recurrence_day=body.recurrence_day,
        next_run_at=_compute_next_run(
            body.recurrence_type, body.recurrence_interval, body.recurrence_day
        ),
        is_active=True,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)


@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alle Vorlagen eines Projekts auflisten."""
    result = await db.execute(
        select(TaskTemplate)
        .where(TaskTemplate.project_id == project_id)
        .order_by(TaskTemplate.created_at.desc())
    )
    return [TemplateResponse.model_validate(t) for t in result.scalars().all()]


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(
    project_id: str,
    template_id: str,
    body: TemplateUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Vorlage aktualisieren."""
    result = await db.execute(
        select(TaskTemplate).where(
            TaskTemplate.id == template_id,
            TaskTemplate.project_id == project_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")

    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(template, key, value)

    # Recalculate next_run if recurrence changed
    if any(k in updates for k in ("recurrence_type", "recurrence_interval", "recurrence_day")):
        template.next_run_at = _compute_next_run(
            template.recurrence_type, template.recurrence_interval, template.recurrence_day
        )

    await db.commit()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    project_id: str,
    template_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Vorlage loeschen."""
    result = await db.execute(
        select(TaskTemplate).where(
            TaskTemplate.id == template_id,
            TaskTemplate.project_id == project_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")

    await db.delete(template)
    await db.commit()
