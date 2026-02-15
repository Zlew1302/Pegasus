import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.agent import AgentInstance
from app.models.approval import Approval
from app.models.comment import Comment
from app.models.execution import ExecutionStep
from app.models.output import TaskOutput
from app.models.task import Task, TaskHistory
from app.schemas.activity import ActivityEntry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tasks", tags=["activity"])

# German field name labels
FIELD_LABELS: dict[str, str] = {
    "status": "Status",
    "priority": "Priorität",
    "title": "Titel",
    "description": "Beschreibung",
    "assignee_agent_type_id": "Agent-Zuweisung",
    "assignee_human_id": "Zuständiger",
    "deadline": "Frist",
    "start_date": "Startdatum",
    "estimated_duration_minutes": "Geschätzte Dauer",
    "actual_duration_minutes": "Tatsächliche Dauer",
    "acceptance_criteria": "Akzeptanzkriterien",
    "sort_order": "Reihenfolge",
    "tags": "Tags",
    "autonomy_level": "Autonomiestufe",
    "task_type": "Aufgabentyp",
}

STATUS_LABELS: dict[str, str] = {
    "backlog": "Backlog",
    "todo": "Zu erledigen",
    "in_progress": "In Bearbeitung",
    "review": "Review",
    "done": "Erledigt",
    "blocked": "Blockiert",
}


def _format_value(field: str, value: str | None) -> str:
    """Format field values for human-readable display."""
    if value is None:
        return "–"
    if field == "status":
        return STATUS_LABELS.get(value, value)
    return value


@router.get("/{task_id}/activity", response_model=list[ActivityEntry])
async def get_task_activity(
    task_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityEntry]:
    """Aggregate activity from all sources into a unified chronological timeline."""

    # Verify task belongs to user's project
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        return []

    entries: list[ActivityEntry] = []

    # 1. Task History (status changes, field changes)
    history_result = await db.execute(
        select(TaskHistory).where(TaskHistory.task_id == task_id)
    )
    for h in history_result.scalars().all():
        field_label = FIELD_LABELS.get(h.field_name, h.field_name)
        is_status = h.field_name == "status"

        if is_status:
            old_label = _format_value("status", h.old_value)
            new_label = _format_value("status", h.new_value)
            summary = f"{old_label} → {new_label}"
        else:
            summary = f"{field_label} geändert"

        entries.append(
            ActivityEntry(
                id=h.id,
                type="status_change" if is_status else "field_change",
                timestamp=h.changed_at,
                actor_type=h.changed_by_type or "system",
                actor_name=h.changed_by_id,
                summary=summary,
                field_name=h.field_name,
                old_value=h.old_value,
                new_value=h.new_value,
            )
        )

    # 2. Comments
    comment_result = await db.execute(
        select(Comment).where(Comment.task_id == task_id)
    )
    for c in comment_result.scalars().all():
        preview = c.content[:120] + "…" if len(c.content) > 120 else c.content
        entries.append(
            ActivityEntry(
                id=c.id,
                type="comment",
                timestamp=c.created_at,
                actor_type=c.author_type,
                actor_name=c.author_name,
                summary=f"Kommentar von {c.author_name}",
                content=c.content,
                details=preview,
            )
        )

    # 3. Task Outputs
    output_result = await db.execute(
        select(TaskOutput).where(TaskOutput.task_id == task_id)
    )
    for o in output_result.scalars().all():
        entries.append(
            ActivityEntry(
                id=o.id,
                type="output",
                timestamp=o.created_at,
                actor_type=o.created_by_type,
                actor_name=o.created_by_id,
                summary=f"Ergebnis v{o.version} erstellt",
                content=o.content[:200] if o.content else None,
                version=o.version,
            )
        )

    # 4. Approvals
    approval_result = await db.execute(
        select(Approval).where(Approval.task_id == task_id)
    )
    for a in approval_result.scalars().all():
        # Add request event
        entries.append(
            ActivityEntry(
                id=f"{a.id}-req",
                type="approval_requested",
                timestamp=a.requested_at,
                actor_type="agent",
                actor_name=a.agent_instance_id,
                summary=f"Genehmigung angefragt: {a.description or a.type}",
                approval_status="pending",
            )
        )
        # Add resolution event if resolved
        if a.resolved_at:
            status_label = {
                "approved": "Genehmigt",
                "rejected": "Abgelehnt",
                "changes_requested": "Änderungen angefragt",
            }.get(a.status, a.status)
            entries.append(
                ActivityEntry(
                    id=f"{a.id}-res",
                    type="approval_resolved",
                    timestamp=a.resolved_at,
                    actor_type="human",
                    actor_name=a.reviewer_id,
                    summary=f"Genehmigung: {status_label}",
                    details=a.reviewer_comment,
                    approval_status=a.status,
                )
            )

    # 5. Execution Steps (from agent instances linked to this task)
    instance_result = await db.execute(
        select(AgentInstance).where(AgentInstance.task_id == task_id)
    )
    instance_ids = [i.id for i in instance_result.scalars().all()]

    if instance_ids:
        step_result = await db.execute(
            select(ExecutionStep).where(
                ExecutionStep.agent_instance_id.in_(instance_ids)
            )
        )
        for s in step_result.scalars().all():
            ts = s.completed_at or s.started_at
            if ts:
                entries.append(
                    ActivityEntry(
                        id=s.id,
                        type="agent_step",
                        timestamp=ts,
                        actor_type="agent",
                        actor_name=s.agent_instance_id,
                        summary=s.description or f"Agent-Schritt #{s.step_number}",
                        step_type=s.step_type,
                        tokens_in=s.tokens_in,
                        tokens_out=s.tokens_out,
                        cost_cents=s.cost_cents,
                    )
                )

    # Sort by timestamp descending and limit
    entries.sort(key=lambda e: e.timestamp, reverse=True)
    return entries[:limit]
