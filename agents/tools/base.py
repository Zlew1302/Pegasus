"""Base tool interface for agent tools."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from agents.briefing import TaskBriefing
from app.sse.manager import SSEManager


@dataclass
class ToolContext:
    """Context passed to tools during execution."""
    session_factory: async_sessionmaker[AsyncSession]
    briefing: TaskBriefing
    instance_id: str
    sse_manager: SSEManager


class BaseTool(ABC):
    """Abstract base class for all agent tools."""

    name: str = ""
    description: str = ""

    @abstractmethod
    def input_schema(self) -> dict[str, Any]:
        """Return JSON Schema for tool parameters."""
        ...

    @abstractmethod
    async def execute(self, parameters: dict[str, Any], context: ToolContext) -> str:
        """Execute the tool and return result as string."""
        ...

    def to_anthropic_format(self) -> dict[str, Any]:
        """Convert to Anthropic API tool definition format."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema(),
        }
