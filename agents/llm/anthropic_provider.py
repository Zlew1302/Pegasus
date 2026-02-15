"""Anthropic Claude LLM provider."""

import logging

from anthropic import AsyncAnthropic, RateLimitError, APIStatusError

from agents.llm.base import LLMProvider, LLMMessage

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (in cents)
ANTHROPIC_PRICING = {
    "claude-sonnet-4-20250514": {"input": 300, "output": 1500},
    "claude-haiku-4-20250514": {"input": 80, "output": 400},
    "claude-opus-4-20250514": {"input": 1500, "output": 7500},
    # Fallback for unknown models
    "default": {"input": 300, "output": 1500},
}


class AnthropicProvider(LLMProvider):
    """Provider wrapping the Anthropic Claude API."""

    def __init__(self, model: str, api_key: str | None = None, base_url: str | None = None):
        super().__init__(model, api_key, base_url)
        kwargs = {}
        if api_key:
            kwargs["api_key"] = api_key
        if base_url:
            kwargs["base_url"] = base_url
        self.client = AsyncAnthropic(**kwargs)

    async def create_message(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> LLMMessage:
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools

        response = await self.client.messages.create(**kwargs)

        # Extract text content and tool uses
        text_parts = []
        tool_calls = []
        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })

        return LLMMessage(
            content="\n".join(text_parts),
            tool_calls=tool_calls,
            stop_reason=response.stop_reason,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )

    def format_tools(self, tools: list[dict]) -> list[dict]:
        """Anthropic tools are already in the correct format."""
        return tools

    def format_tool_results(self, tool_results: list[dict]) -> list[dict]:
        """Anthropic tool results are already in the correct format."""
        return tool_results

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        pricing = ANTHROPIC_PRICING.get(self.model, ANTHROPIC_PRICING["default"])
        cost = (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
        return cost
