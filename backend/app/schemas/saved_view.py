from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class SavedViewCreate(BaseModel):
    name: str
    filter_json: str


class SavedViewUpdate(BaseModel):
    name: Optional[str] = None
    filter_json: Optional[str] = None


class SavedViewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    project_id: str
    filter_json: str
    sort_order: int
    created_at: datetime
