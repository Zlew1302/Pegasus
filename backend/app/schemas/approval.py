from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ApprovalResolve(BaseModel):
    status: str  # approved, rejected, changes_requested
    comment: Optional[str] = None


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    agent_instance_id: Optional[str]
    requested_at: datetime
    type: str
    status: str
    description: Optional[str]
    reviewer_comment: Optional[str]
    resolved_at: Optional[datetime]
