from datetime import datetime

from pydantic import BaseModel


class ActivityEntry(BaseModel):
    """Unified activity entry aggregated from multiple sources."""

    id: str
    type: str  # status_change, field_change, comment, output, approval_requested, approval_resolved, agent_step
    timestamp: datetime
    actor_type: str  # human, agent, system
    actor_name: str | None = None
    summary: str
    details: str | None = None

    # Type-specific fields (optional, populated per type)
    field_name: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    content: str | None = None
    version: int | None = None
    approval_status: str | None = None
    step_type: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_cents: int | None = None
