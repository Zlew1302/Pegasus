"""Scheduler service for recurring task generation."""

import asyncio
import logging
from datetime import datetime, UTC, timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.task import Task
from app.models.task_template import TaskTemplate

logger = logging.getLogger(__name__)


async def check_and_generate_recurring_tasks(session_factory: async_sessionmaker[AsyncSession]):
    """Prüft alle aktiven Vorlagen und erstellt fällige Tasks."""
    now = datetime.now(UTC)
    async with session_factory() as session:
        result = await session.execute(
            select(TaskTemplate).where(
                TaskTemplate.is_active == True,
                TaskTemplate.recurrence_type.isnot(None),
                TaskTemplate.next_run_at.isnot(None),
                TaskTemplate.next_run_at <= now,
            )
        )
        templates = result.scalars().all()

        for template in templates:
            try:
                # Create task from template
                task = Task(
                    id=str(uuid4()),
                    project_id=template.project_id,
                    title=template.title,
                    description=template.description,
                    priority=template.priority,
                    assignee_agent_type_id=template.assignee_agent_type_id,
                    status="todo",
                    sort_order=0,
                )
                session.add(task)

                # Update next_run_at
                template.next_run_at = _compute_next_run(
                    template.recurrence_type,
                    template.recurrence_interval,
                    template.next_run_at,
                )

                logger.info(
                    "Wiederkehrende Aufgabe erstellt: %s (Template: %s)",
                    task.title,
                    template.id,
                )
            except Exception:
                logger.exception("Fehler beim Erstellen wiederkehrender Aufgabe: %s", template.id)

        await session.commit()
        if templates:
            logger.info("%d wiederkehrende Aufgaben verarbeitet", len(templates))


def _compute_next_run(
    rec_type: str | None,
    interval: int,
    current_run: datetime | None,
) -> datetime | None:
    """Berechnet den nächsten Ausführungszeitpunkt basierend auf dem aktuellen."""
    if not rec_type or not current_run:
        return None
    if rec_type == "daily":
        return current_run + timedelta(days=interval)
    if rec_type == "weekly":
        return current_run + timedelta(weeks=interval)
    if rec_type == "monthly":
        return current_run + timedelta(days=30 * interval)
    return None


async def scheduler_loop(session_factory: async_sessionmaker[AsyncSession]):
    """Endlos-Schleife die alle 60 Sekunden wiederkehrende Tasks prüft."""
    logger.info("Scheduler gestartet — prüfe alle 60 Sekunden")
    while True:
        try:
            await check_and_generate_recurring_tasks(session_factory)
        except Exception:
            logger.exception("Fehler im Scheduler-Loop")
        await asyncio.sleep(60)
