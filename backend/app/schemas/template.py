from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TemplateCreate(BaseModel):
    title: str
    description: str | None = None
    priority: str = "medium"
    assignee_agent_type_id: str | None = None
    recurrence_type: str | None = None
    recurrence_interval: int = 1
    recurrence_day: int | None = None


class TemplateUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    assignee_agent_type_id: str | None = None
    recurrence_type: str | None = None
    recurrence_interval: int | None = None
    recurrence_day: int | None = None
    is_active: bool | None = None


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    description: str | None = None
    priority: str = "medium"
    assignee_agent_type_id: str | None = None
    recurrence_type: str | None = None
    recurrence_interval: int = 1
    recurrence_day: int | None = None
    next_run_at: datetime | None = None
    is_active: bool = True
    created_at: datetime
