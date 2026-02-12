from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    author_name: str
    content: str
    author_type: str = "human"


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    author_type: str
    author_name: str
    content: str
    created_at: datetime
