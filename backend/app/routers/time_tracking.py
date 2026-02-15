import logging
from datetime import datetime, UTC
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sql_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.task import Task
from app.models.time_entry import TimeEntry
from app.schemas.time_entry import TimeEntryCreate, TimeEntryResponse, TimeSummaryEntry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["time-tracking"])


@router.post("/tasks/{task_id}/timer/start", response_model=TimeEntryResponse, status_code=201)
async def start_timer(
    task_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Timer fuer eine Aufgabe starten."""
    # Check no running timer for this task
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.task_id == task_id,
            TimeEntry.user_id == user_id,
            TimeEntry.is_running == True,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Timer laeuft bereits fuer diese Aufgabe")

    entry = TimeEntry(
        id=str(uuid4()),
        task_id=task_id,
        user_id=user_id,
        started_at=datetime.now(UTC),
        is_running=True,
        duration_minutes=0,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return TimeEntryResponse.model_validate(entry)


@router.post("/tasks/{task_id}/timer/stop", response_model=TimeEntryResponse)
async def stop_timer(
    task_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Laufenden Timer stoppen und Dauer berechnen."""
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.task_id == task_id,
            TimeEntry.user_id == user_id,
            TimeEntry.is_running == True,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Kein laufender Timer fuer diese Aufgabe")

    now = datetime.now(UTC)
    entry.ended_at = now
    entry.is_running = False
    delta = now - entry.started_at
    entry.duration_minutes = max(1, int(delta.total_seconds() / 60))

    await db.commit()
    await db.refresh(entry)

    # Update task's actual_duration_minutes
    await _update_task_duration(db, task_id)

    return TimeEntryResponse.model_validate(entry)


@router.post("/tasks/{task_id}/time-entries", response_model=TimeEntryResponse, status_code=201)
async def create_manual_entry(
    task_id: str,
    body: TimeEntryCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manuellen Zeiteintrag erstellen."""
    now = datetime.now(UTC)
    entry = TimeEntry(
        id=str(uuid4()),
        task_id=task_id,
        user_id=user_id,
        started_at=now,
        ended_at=now,
        duration_minutes=body.duration_minutes,
        note=body.note,
        is_running=False,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    await _update_task_duration(db, task_id)

    return TimeEntryResponse.model_validate(entry)


@router.get("/tasks/{task_id}/time-entries", response_model=list[TimeEntryResponse])
async def list_time_entries(
    task_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alle Zeiteintraege einer Aufgabe auflisten."""
    result = await db.execute(
        select(TimeEntry)
        .where(TimeEntry.task_id == task_id)
        .order_by(TimeEntry.created_at.desc())
    )
    return [TimeEntryResponse.model_validate(e) for e in result.scalars().all()]


@router.delete("/time-entries/{entry_id}", status_code=204)
async def delete_time_entry(
    entry_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Zeiteintrag loeschen."""
    result = await db.execute(
        select(TimeEntry).where(TimeEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Zeiteintrag nicht gefunden")

    task_id = entry.task_id
    await db.delete(entry)
    await db.commit()

    await _update_task_duration(db, task_id)


@router.get("/projects/{project_id}/time-summary", response_model=list[TimeSummaryEntry])
async def project_time_summary(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Zeitauswertung pro Task eines Projekts."""
    result = await db.execute(
        select(
            TimeEntry.task_id,
            Task.title.label("task_title"),
            sql_func.sum(TimeEntry.duration_minutes).label("total_minutes"),
            sql_func.count(TimeEntry.id).label("entry_count"),
        )
        .join(Task, TimeEntry.task_id == Task.id)
        .where(Task.project_id == project_id)
        .group_by(TimeEntry.task_id, Task.title)
        .order_by(sql_func.sum(TimeEntry.duration_minutes).desc())
    )
    return [
        TimeSummaryEntry(
            task_id=row.task_id,
            task_title=row.task_title or "",
            total_minutes=row.total_minutes or 0,
            entry_count=row.entry_count or 0,
        )
        for row in result.all()
    ]


async def _update_task_duration(db: AsyncSession, task_id: str):
    """Aktualisiert actual_duration_minutes auf dem Task."""
    result = await db.execute(
        select(sql_func.sum(TimeEntry.duration_minutes))
        .where(TimeEntry.task_id == task_id, TimeEntry.is_running == False)
    )
    total = result.scalar() or 0
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if task:
        task.actual_duration_minutes = total
        await db.commit()
