from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AgentTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    avatar: Optional[str]
    description: Optional[str]
    capabilities: Optional[str]
    provider: str = "anthropic"
    provider_base_url: Optional[str] = None
    model: str
    max_concurrent_instances: int
    trust_level: str
    is_custom: bool


class AgentTypeCreateRequest(BaseModel):
    name: str
    description: str | None = None
    capabilities: str | None = None  # JSON array string
    tools: str | None = None  # JSON array string
    system_prompt: str | None = None
    provider: str = "anthropic"
    provider_base_url: str | None = None
    model: str = "claude-sonnet-4-20250514"
    temperature: float = 0.3
    max_tokens: int = 4096
    max_concurrent_instances: int = 5
    trust_level: str = "propose"  # propose | execute | full_auto
    context_scope: str | None = None


class AgentTypeUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    capabilities: str | None = None
    tools: str | None = None
    system_prompt: str | None = None
    provider: str | None = None
    provider_base_url: str | None = None
    model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    max_concurrent_instances: int | None = None
    trust_level: str | None = None
    context_scope: str | None = None


class AgentTypeDetailResponse(AgentTypeResponse):
    """Volle Antwort mit allen Konfigurationsfeldern."""
    tools: str | None = None
    system_prompt: str | None = None
    temperature: float = 0.3
    max_tokens: int = 4096
    context_scope: str | None = None


class AgentSpawnRequest(BaseModel):
    agent_type_id: str
    task_id: str


class AgentInstanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_type_id: str
    task_id: str
    status: str
    current_step: Optional[str]
    total_steps: Optional[int]
    progress_percent: int
    thought_log: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    parent_instance_id: Optional[str] = None
    total_cost_cents: int


class AgentInstanceWithTaskResponse(AgentInstanceResponse):
    task_title: str | None = None
    agent_type_name: str | None = None
    project_id: str | None = None
    project_title: str | None = None


class AgentMessageRequest(BaseModel):
    message: str


class AgentSuggestionResponse(BaseModel):
    agent_type_id: str
    agent_type_name: str
    confidence: int
    reason: str


class ExecutionStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_instance_id: str
    step_number: int
    step_type: str
    description: Optional[str]
    model: Optional[str]
    tokens_in: Optional[int]
    tokens_out: Optional[int]
    cost_cents: Optional[int]
    duration_ms: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
