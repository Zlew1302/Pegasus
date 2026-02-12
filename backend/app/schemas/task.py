from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    status: str = "backlog"
    priority: str = "medium"
    task_type: Optional[str] = None
    assignee_agent_type_id: Optional[str] = None
    autonomy_level: str = "needs_approval"
    estimated_duration_minutes: Optional[int] = None
    tags: Optional[str] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    parent_task_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    priority: Optional[str] = None
    task_type: Optional[str] = None
    assignee_agent_type_id: Optional[str] = None
    autonomy_level: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    tags: Optional[str] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None


class TaskStatusUpdate(BaseModel):
    status: str


class TaskPositionUpdate(BaseModel):
    status: str
    sort_order: int


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    parent_task_id: Optional[str]
    title: str
    description: Optional[str]
    acceptance_criteria: Optional[str]
    status: str
    priority: str
    task_type: Optional[str]
    assignee_human_id: Optional[str]
    assignee_agent_type_id: Optional[str]
    autonomy_level: str
    estimated_duration_minutes: Optional[int]
    actual_duration_minutes: Optional[int]
    sort_order: int
    tags: Optional[str]
    start_date: Optional[datetime]
    deadline: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class TaskHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    changed_by_type: str
    changed_by_id: Optional[str]
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    changed_at: datetime
