"""Notification helpers for creating system notifications."""

from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create_notification(
    session: AsyncSession,
    type: str,
    title: str,
    message: str | None = None,
    link: str | None = None,
    priority: str = "info",
) -> Notification:
    notification = Notification(
        id=str(uuid4()),
        type=type,
        title=title,
        message=message,
        link=link,
        priority=priority,
    )
    session.add(notification)
    return notification


async def notify_approval_needed(
    session: AsyncSession,
    task_title: str,
    task_id: str,
):
    return await create_notification(
        session,
        type="approval_needed",
        title="Genehmigung erforderlich",
        message=f"Task '{task_title}' wartet auf Genehmigung.",
        link=f"/projects?task={task_id}",
        priority="high",
    )


async def notify_agent_completed(
    session: AsyncSession,
    task_title: str,
    agent_name: str,
):
    return await create_notification(
        session,
        type="agent_completed",
        title=f"{agent_name} fertig",
        message=f"Agent hat Task '{task_title}' abgeschlossen.",
        priority="info",
    )


async def notify_comment_added(
    session: AsyncSession,
    task_title: str,
    author_name: str,
):
    return await create_notification(
        session,
        type="comment_added",
        title="Neuer Kommentar",
        message=f"{author_name} hat '{task_title}' kommentiert.",
        priority="low",
    )
