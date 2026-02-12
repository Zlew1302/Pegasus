"""Lightweight tool context for Spotlight (no TaskBriefing needed)."""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


@dataclass
class SpotlightToolContext:
    """Context passed to Spotlight tools during execution."""
    session_factory: async_sessionmaker[AsyncSession]
    session_id: str
    current_path: str = "/"
    current_entity_id: str | None = None
    user_id: str = "default-user"
