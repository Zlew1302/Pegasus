from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationCreate,
    NotificationMarkRead,
    NotificationResponse,
)

router = APIRouter(prefix="/api", tags=["notifications"])


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Notification)
    if unread_only:
        query = query.where(Notification.is_read == False)
    query = query.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/notifications/unread-count")
async def unread_count(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(func.count(Notification.id)).where(Notification.is_read == False)
    )
    count = result.scalar() or 0
    return {"count": count}


@router.post("/notifications", response_model=NotificationResponse, status_code=201)
async def create_notification(
    data: NotificationCreate, db: AsyncSession = Depends(get_db)
):
    notification = Notification(
        id=str(uuid4()),
        type=data.type,
        title=data.title,
        message=data.message,
        link=data.link,
        priority=data.priority,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


@router.patch("/notifications/mark-read")
async def mark_read(data: NotificationMarkRead, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification).where(Notification.id.in_(data.ids))
    )
    notifications = result.scalars().all()
    for n in notifications:
        n.is_read = True
    await db.commit()
    return {"marked": len(notifications)}


@router.delete("/notifications/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: str, db: AsyncSession = Depends(get_db)
):
    notification = await db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(404, "Benachrichtigung nicht gefunden")
    await db.delete(notification)
    await db.commit()
