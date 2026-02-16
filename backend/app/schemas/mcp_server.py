"""Pydantic schemas for MCP server management."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ── Request Schemas ─────────────────────────────────────────

class McpServerCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    server_url: str
    auth_type: str = "none"  # none | bearer | api_key
    auth_token: str | None = None  # Klartext — wird im Backend verschlüsselt
    icon: str = "plug"


class McpServerUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    server_url: str | None = None
    auth_type: str | None = None
    auth_token: str | None = None
    icon: str | None = None


# ── Response Schemas ────────────────────────────────────────

class McpToolDefinition(BaseModel):
    """Schema für ein einzelnes MCP-Tool."""
    name: str
    description: str = ""
    input_schema: dict | None = None


class McpServerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: str | None
    server_url: str
    auth_type: str
    icon: str
    is_connected: bool
    available_tools: str | None  # JSON array
    last_health_check: datetime | None
    created_at: datetime
    updated_at: datetime


class McpServerListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: str | None
    icon: str
    is_connected: bool
    server_url: str
    auth_type: str
    last_health_check: datetime | None
    tool_count: int = 0
