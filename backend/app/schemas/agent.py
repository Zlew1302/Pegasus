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
    model: str
    max_concurrent_instances: int
    trust_level: str
    is_custom: bool


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
