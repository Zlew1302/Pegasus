"""Task business logic including status machine validation."""

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskDependency, TaskHistory

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


async def check_dependencies_met(
    session: AsyncSession, task_id: str
) -> tuple[bool, list[str]]:
    """Check if all dependencies of a task are done.

    Returns (all_met, list_of_blocking_task_titles).
    """
    result = await session.execute(
        select(TaskDependency.depends_on_task_id)
        .where(TaskDependency.task_id == task_id)
    )
    dep_ids = [row[0] for row in result.all()]

    if not dep_ids:
        return True, []

    blocking: list[str] = []
    for dep_id in dep_ids:
        dep_task = await session.get(Task, dep_id)
        if dep_task and dep_task.status != "done":
            blocking.append(dep_task.title)

    return len(blocking) == 0, blocking


async def has_circular_dependency(
    session: AsyncSession, task_id: str, depends_on_id: str
) -> bool:
    """Check if adding a dependency would create a circular reference."""
    visited: set[str] = set()
    stack = [depends_on_id]

    while stack:
        current = stack.pop()
        if current == task_id:
            return True
        if current in visited:
            continue
        visited.add(current)

        result = await session.execute(
            select(TaskDependency.depends_on_task_id)
            .where(TaskDependency.task_id == current)
        )
        for row in result.all():
            stack.append(row[0])

    return False
