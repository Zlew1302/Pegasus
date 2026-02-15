"""OpenAI-compatible LLM provider (works with OpenAI, Kimi/Moonshot, etc.)."""

import json
import logging

from agents.llm.base import LLMProvider, LLMMessage

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (in cents) — approximate
OPENAI_PRICING = {
    "gpt-4o": {"input": 250, "output": 1000},
    "gpt-4o-mini": {"input": 15, "output": 60},
    "gpt-4-turbo": {"input": 1000, "output": 3000},
    "o3-mini": {"input": 110, "output": 440},
    # Kimi models (approximate)
    "kimi-k2-0711": {"input": 200, "output": 800},
    "moonshot-v1-auto": {"input": 200, "output": 800},
    # Fallback
    "default": {"input": 250, "output": 1000},
}


class OpenAICompatibleProvider(LLMProvider):
    """Provider for OpenAI-compatible APIs (OpenAI, Kimi/Moonshot, etc.)."""

    def __init__(self, model: str, api_key: str | None = None, base_url: str | None = None):
        super().__init__(model, api_key, base_url)
        self._client = None

    def _get_client(self):
        """Lazy-load the openai client."""
        if self._client is None:
            try:
                from openai import AsyncOpenAI
            except ImportError:
                raise ImportError(
                    "openai package nicht installiert. "
                    "Bitte 'pip install openai>=1.0.0' ausführen."
                )
            kwargs = {}
            if self.api_key:
                kwargs["api_key"] = self.api_key
            if self.base_url:
                kwargs["base_url"] = self.base_url
            self._client = AsyncOpenAI(**kwargs)
        return self._client

    async def create_message(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> LLMMessage:
        client = self._get_client()

        # Convert Anthropic-style messages to OpenAI format
        oai_messages = [{"role": "system", "content": system}]
        for msg in messages:
            oai_messages.append(self._convert_message(msg))

        kwargs = {
            "model": self.model,
            "messages": oai_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = self.format_tools(tools)

        response = await client.chat.completions.create(**kwargs)

        choice = response.choices[0]
        content = choice.message.content or ""
        tool_calls = []

        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except (json.JSONDecodeError, TypeError):
                    args = {}
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "input": args,
                })

        # Map finish_reason to Anthropic-style stop_reason
        stop_map = {
            "stop": "end_turn",
            "tool_calls": "tool_use",
            "length": "max_tokens",
        }
        stop_reason = stop_map.get(choice.finish_reason, "end_turn")

        return LLMMessage(
            content=content,
            tool_calls=tool_calls,
            stop_reason=stop_reason,
            input_tokens=response.usage.prompt_tokens if response.usage else 0,
            output_tokens=response.usage.completion_tokens if response.usage else 0,
        )

    def _convert_message(self, msg: dict) -> dict:
        """Convert Anthropic message format to OpenAI format."""
        role = msg.get("role", "user")

        # Simple text message
        if isinstance(msg.get("content"), str):
            return {"role": role, "content": msg["content"]}

        # Content blocks (Anthropic style)
        if isinstance(msg.get("content"), list):
            # Check if this is a tool result message
            parts = msg["content"]
            text_parts = []
            tool_results = []

            for part in parts:
                if isinstance(part, dict):
                    if part.get("type") == "text":
                        text_parts.append(part.get("text", ""))
                    elif part.get("type") == "tool_result":
                        tool_results.append(part)
                    elif part.get("type") == "tool_use":
                        # Assistant message with tool call
                        return {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [{
                                "id": part["id"],
                                "type": "function",
                                "function": {
                                    "name": part["name"],
                                    "arguments": json.dumps(part.get("input", {})),
                                },
                            }],
                        }

            if tool_results:
                # Return as tool role messages
                return {
                    "role": "tool",
                    "tool_call_id": tool_results[0].get("tool_use_id", ""),
                    "content": tool_results[0].get("content", ""),
                }

            if text_parts:
                return {"role": role, "content": "\n".join(text_parts)}

        return {"role": role, "content": str(msg.get("content", ""))}

    def format_tools(self, tools: list[dict]) -> list[dict]:
        """Convert Anthropic tool format to OpenAI function calling format."""
        oai_tools = []
        for tool in tools:
            oai_tools.append({
                "type": "function",
                "function": {
                    "name": tool.get("name", ""),
                    "description": tool.get("description", ""),
                    "parameters": tool.get("input_schema", {}),
                },
            })
        return oai_tools

    def format_tool_results(self, tool_results: list[dict]) -> list[dict]:
        """Convert Anthropic tool results to OpenAI format."""
        return tool_results

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        pricing = OPENAI_PRICING.get(self.model, OPENAI_PRICING["default"])
        cost = (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
        return cost
