"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMMessage:
    """Unified message format returned by all providers."""
    content: str
    tool_calls: list[dict]  # [{id, name, input}]
    stop_reason: str  # "end_turn", "tool_use", "max_tokens"
    input_tokens: int
    output_tokens: int


class LLMProvider(ABC):
    """Abstract interface for LLM providers (Anthropic, OpenAI-compatible, etc.)."""

    def __init__(self, model: str, api_key: str | None = None, base_url: str | None = None):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url

    @abstractmethod
    async def create_message(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> LLMMessage:
        """Send a message and get a response. Returns unified LLMMessage."""
        ...

    @abstractmethod
    def format_tools(self, tools: list[dict]) -> list[dict]:
        """Convert internal tool definitions to provider-specific format."""
        ...

    @abstractmethod
    def format_tool_results(self, tool_results: list[dict]) -> list[dict]:
        """Convert tool results into the format expected by this provider."""
        ...

    @abstractmethod
    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost in cents for given token counts."""
        ...
