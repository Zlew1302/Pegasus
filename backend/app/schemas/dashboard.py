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


class AgentCostEntry(BaseModel):
    agent_type_name: str
    total_cost_cents: int
    total_tokens_in: int
    total_tokens_out: int
    instance_count: int


class BudgetOverviewEntry(BaseModel):
    project_id: str
    project_title: str
    budget_cents: int
    spent_cents: int


class BudgetOverview(BaseModel):
    projects: list[BudgetOverviewEntry]
    total_budget_cents: int
    total_spent_cents: int
