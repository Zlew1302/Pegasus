from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class NotificationCreate(BaseModel):
    type: str
    title: str
    message: Optional[str] = None
    link: Optional[str] = None
    priority: str = "info"


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str]
    type: Optional[str]
    priority: str
    title: Optional[str]
    message: Optional[str]
    link: Optional[str]
    bundle_group: Optional[str]
    is_read: bool
    created_at: datetime


class NotificationMarkRead(BaseModel):
    ids: list[str]
