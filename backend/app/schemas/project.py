from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    goal: Optional[str] = None
    status: str = "active"
    phase: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget_cents: int = 0
    team_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    goal: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget_cents: Optional[int] = None
    team_id: Optional[str] = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    title: str
    description: Optional[str]
    goal: Optional[str]
    status: str
    phase: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    budget_cents: int
    team_id: Optional[str]
    is_incognito: bool
    created_at: datetime
    updated_at: datetime
    task_count: int = 0
