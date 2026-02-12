"""Schemas for the Spotlight AI chat endpoint."""

from pydantic import BaseModel, ConfigDict


class SpotlightContext(BaseModel):
    """Page context sent from the frontend."""
    model_config = ConfigDict(from_attributes=True)

    current_path: str = "/"
    current_page_type: str = ""
    current_entity_id: str | None = None
    current_entity_title: str | None = None


class SpotlightMessage(BaseModel):
    """A single message in the conversation history."""
    role: str  # "user" or "assistant"
    content: str


class SpotlightChatRequest(BaseModel):
    """Request body for POST /api/spotlight/chat."""
    message: str
    context: SpotlightContext = SpotlightContext()
    history: list[SpotlightMessage] = []
