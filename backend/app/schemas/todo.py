from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TodoCreate(BaseModel):
    title: str
    project_id: Optional[str] = None
    sort_order: int = 0


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    sort_order: Optional[int] = None
    is_completed: Optional[bool] = None


class TodoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    sort_order: int
    is_completed: bool
    project_id: Optional[str]
    created_at: datetime
    updated_at: datetime
