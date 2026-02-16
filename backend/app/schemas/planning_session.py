"""Pydantic schemas for the KI planning workflow."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ── Request Schemas ─────────────────────────────────────────

class PlanningSessionCreate(BaseModel):
    project_id: str
    input_mode: str = "project_overview"  # project_overview | custom_input


class PlanningSessionInputUpdate(BaseModel):
    user_notes: str | None = None
    knowledge_doc_ids: list[str] | None = None
    web_search_topics: list[str] | None = None
    auto_context: bool = False


class PlanTaskSuggestion(BaseModel):
    title: str
    description: str | None = None
    priority: str = "medium"
    agent_type_id: str | None = None
    agent_type_name: str | None = None
    estimated_duration_minutes: int | None = None
    tags: str | None = None
    acceptance_criteria: str | None = None
    milestone: str | None = None
    order: int = 0


class MilestoneSuggestion(BaseModel):
    name: str
    tasks: list[str] = []  # Task titles in this milestone


class GeneratedPlan(BaseModel):
    tasks: list[PlanTaskSuggestion] = []
    milestones: list[MilestoneSuggestion] = []
    summary: str = ""
    timeline_notes: str | None = None


class ConfirmPlanRequest(BaseModel):
    tasks: list[PlanTaskSuggestion]
    auto_start_agents: bool = False


class ExaSearchRequest(BaseModel):
    topics: list[str]


# ── Response Schemas ────────────────────────────────────────

class ExaSearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    score: float = 0.0


class PlanningSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    user_id: str
    status: str
    input_mode: str
    user_notes: str | None
    knowledge_doc_ids: str | None
    web_search_topics: str | None
    web_search_results: str | None
    auto_context: bool
    generated_plan: str | None
    confirmed_plan: str | None
    agent_instance_id: str | None
    created_at: datetime
    updated_at: datetime
