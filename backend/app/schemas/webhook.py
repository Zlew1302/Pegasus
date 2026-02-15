from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WebhookCreate(BaseModel):
    name: str
    url: str
    events: str = ""  # comma-separated event types


class WebhookUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    events: str | None = None
    is_active: bool | None = None


class WebhookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    url: str
    events: str
    secret: str
    is_active: bool
    created_at: datetime


class WebhookDeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    webhook_id: str
    event_type: str
    status_code: int | None = None
    error_message: str | None = None
    attempt: int
    created_at: datetime
