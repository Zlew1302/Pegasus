from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# --- User Profile ---

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    avatar_url: Optional[str]
    global_system_prompt: Optional[str]
    preferences_json: Optional[str]
    created_at: datetime
    updated_at: datetime


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    global_system_prompt: Optional[str] = None
    preferences_json: Optional[str] = None


# --- API Keys ---

class ApiKeyCreate(BaseModel):
    provider: str
    key_name: str
    key_encrypted: str


class ApiKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    key_name: str
    key_masked: str  # computed, not from DB
    is_active: bool
    created_at: datetime


class ApiKeyToggle(BaseModel):
    is_active: bool


# --- Audit Trail ---

class AuditEntry(BaseModel):
    timestamp: datetime
    actor_type: str  # human, agent, system
    actor_id: Optional[str]
    action: str
    target_type: str
    target_title: str
    details: Optional[str] = None
    tokens: Optional[int] = None
    cost_cents: Optional[int] = None


# --- Token Usage ---

class TokenUsageEntry(BaseModel):
    group_id: str
    group_name: str
    total_tokens_in: int
    total_tokens_out: int
    total_cost_cents: int
