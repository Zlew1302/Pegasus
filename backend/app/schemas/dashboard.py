from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DashboardStats(BaseModel):
    active_agents: int
    pending_inputs: int
    weekly_token_cost_cents: int
    tasks_completed_this_week: int


class ActivityEntry(BaseModel):
    instance_id: str
    agent_name: str
    task_title: str
    status: str
    started_at: Optional[datetime]
    progress_percent: int


class CostEntry(BaseModel):
    date: str  # ISO date string YYYY-MM-DD
    cost_cents: int
    project_id: Optional[str] = None
    project_title: Optional[str] = None


class ProductivityEntry(BaseModel):
    date: str  # ISO date string YYYY-MM-DD
    tasks_completed: int
