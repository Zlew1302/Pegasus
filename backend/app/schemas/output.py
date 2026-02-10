from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TaskOutputCreate(BaseModel):
    content_type: str = "markdown"
    content: Optional[str] = None
    created_by_type: str = "human"
    created_by_id: Optional[str] = None


class TaskOutputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    created_by_type: str
    created_by_id: Optional[str]
    content_type: str
    content: Optional[str]
    file_path: Optional[str]
    version: int
    created_at: datetime
