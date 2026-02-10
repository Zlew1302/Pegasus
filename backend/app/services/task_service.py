"""Task business logic including status machine validation."""

from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import TaskHistory

# Valid status transitions
VALID_TRANSITIONS: dict[str, set[str]] = {
    "backlog": {"todo", "blocked"},
    "todo": {"in_progress", "blocked"},
    "in_progress": {"review", "blocked", "done"},
    "review": {"done", "in_progress", "blocked"},
    "done": {"todo"},  # Reopen
    "blocked": {"todo", "backlog"},
}


def validate_status_transition(current: str, new: str) -> bool:
    allowed = VALID_TRANSITIONS.get(current, set())
    return new in allowed


async def record_history(
    session: AsyncSession,
    task_id: str,
    field_name: str,
    old_value: str | None,
    new_value: str | None,
    changed_by_type: str = "human",
    changed_by_id: str | None = None,
):
    entry = TaskHistory(
        id=str(uuid4()),
        task_id=task_id,
        changed_by_type=changed_by_type,
        changed_by_id=changed_by_id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
    )
    session.add(entry)
