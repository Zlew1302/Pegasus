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


class ApprovalWithContextResponse(ApprovalResponse):
    """Approval enriched with task / agent / project context."""

    task_title: str | None = None
    project_id: str | None = None
    project_title: str | None = None
    agent_type_name: str | None = None
    agent_status: str | None = None
    progress_percent: int | None = None
    current_step: str | None = None
    total_steps: int | None = None
