import logging
import secrets
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db, async_session
from app.models.webhook import Webhook, WebhookDelivery
from app.schemas.webhook import (
    WebhookCreate,
    WebhookDeliveryResponse,
    WebhookResponse,
    WebhookUpdate,
)
from app.services.webhook_service import send_test_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    body: WebhookCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Neuen Webhook erstellen."""
    webhook = Webhook(
        id=str(uuid4()),
        user_id=user_id,
        name=body.name,
        url=body.url,
        events=body.events,
        secret=secrets.token_hex(32),
        is_active=True,
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    return WebhookResponse.model_validate(webhook)


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alle Webhooks auflisten."""
    result = await db.execute(
        select(Webhook)
        .where(Webhook.user_id == user_id)
        .order_by(Webhook.created_at.desc())
    )
    return [WebhookResponse.model_validate(w) for w in result.scalars().all()]


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: str,
    body: WebhookUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Webhook aktualisieren."""
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id, Webhook.user_id == user_id)
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook nicht gefunden")

    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(webhook, key, value)

    await db.commit()
    await db.refresh(webhook)
    return WebhookResponse.model_validate(webhook)


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Webhook loeschen."""
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id, Webhook.user_id == user_id)
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook nicht gefunden")

    await db.delete(webhook)
    await db.commit()


@router.post("/{webhook_id}/test", status_code=200)
async def test_webhook(
    webhook_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test-Event an Webhook senden."""
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id, Webhook.user_id == user_id)
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook nicht gefunden")

    await send_test_event(async_session, webhook)
    return {"status": "Test-Event gesendet"}


@router.get("/{webhook_id}/deliveries", response_model=list[WebhookDeliveryResponse])
async def list_deliveries(
    webhook_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delivery-Log eines Webhooks abrufen."""
    result = await db.execute(
        select(WebhookDelivery)
        .where(WebhookDelivery.webhook_id == webhook_id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(50)
    )
    return [WebhookDeliveryResponse.model_validate(d) for d in result.scalars().all()]
