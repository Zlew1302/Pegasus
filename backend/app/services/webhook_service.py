"""Webhook dispatch service with HMAC signature and retry logic."""

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime, UTC
from uuid import uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.webhook import Webhook, WebhookDelivery

logger = logging.getLogger(__name__)


async def dispatch_event(
    session_factory: async_sessionmaker[AsyncSession],
    event_type: str,
    payload: dict,
):
    """Sendet ein Event an alle aktiven Webhooks die den Event-Typ abonniert haben."""
    async with session_factory() as session:
        result = await session.execute(
            select(Webhook).where(Webhook.is_active == True)
        )
        webhooks = result.scalars().all()

    for webhook in webhooks:
        # Check if webhook subscribes to this event
        subscribed_events = [e.strip() for e in webhook.events.split(",") if e.strip()]
        if subscribed_events and event_type not in subscribed_events:
            continue

        # Fire and forget delivery
        asyncio.create_task(
            _deliver(session_factory, webhook, event_type, payload)
        )


async def _deliver(
    session_factory: async_sessionmaker[AsyncSession],
    webhook: Webhook,
    event_type: str,
    payload: dict,
    max_retries: int = 3,
):
    """Liefert ein Event an einen Webhook mit Retry-Logik."""
    body = json.dumps({
        "event": event_type,
        "timestamp": datetime.now(UTC).isoformat(),
        "data": payload,
    })

    # HMAC Signature
    signature = hmac.new(
        webhook.secret.encode(), body.encode(), hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event_type,
    }

    for attempt in range(1, max_retries + 1):
        delivery_id = str(uuid4())
        status_code = None
        error_message = None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(webhook.url, content=body, headers=headers)
                status_code = response.status_code
                if 200 <= status_code < 300:
                    await _log_delivery(
                        session_factory, delivery_id, webhook.id, event_type,
                        body, status_code, None, attempt
                    )
                    return
                error_message = f"HTTP {status_code}"
        except Exception as e:
            error_message = str(e)[:500]

        await _log_delivery(
            session_factory, delivery_id, webhook.id, event_type,
            body, status_code, error_message, attempt
        )

        if attempt < max_retries:
            wait = (4 ** (attempt - 1))  # 1s, 4s, 16s
            await asyncio.sleep(wait)

    logger.warning(
        "Webhook-Delivery fehlgeschlagen nach %d Versuchen: %s -> %s",
        max_retries, event_type, webhook.url
    )


async def _log_delivery(
    session_factory: async_sessionmaker[AsyncSession],
    delivery_id: str,
    webhook_id: str,
    event_type: str,
    payload: str,
    status_code: int | None,
    error_message: str | None,
    attempt: int,
):
    """Speichert einen Delivery-Log-Eintrag."""
    async with session_factory() as session:
        delivery = WebhookDelivery(
            id=delivery_id,
            webhook_id=webhook_id,
            event_type=event_type,
            payload=payload,
            status_code=status_code,
            error_message=error_message,
            attempt=attempt,
        )
        session.add(delivery)
        await session.commit()


async def send_test_event(
    session_factory: async_sessionmaker[AsyncSession],
    webhook: Webhook,
):
    """Sendet ein Test-Event an einen Webhook."""
    await _deliver(
        session_factory,
        webhook,
        "webhook.test",
        {"message": "Dies ist ein Test-Event von Pegasus."},
        max_retries=1,
    )
