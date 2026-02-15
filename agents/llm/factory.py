"""Factory for creating LLM providers."""

import logging

from agents.llm.base import LLMProvider
from agents.llm.anthropic_provider import AnthropicProvider
from agents.llm.openai_provider import OpenAICompatibleProvider

logger = logging.getLogger(__name__)

# Provider registry: name → (class, default_base_url)
PROVIDER_REGISTRY: dict[str, tuple[type[LLMProvider], str | None]] = {
    "anthropic": (AnthropicProvider, None),
    "openai": (OpenAICompatibleProvider, None),
    "kimi": (OpenAICompatibleProvider, "https://api.moonshot.cn/v1"),
}

# Default models per provider
DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o",
    "kimi": "kimi-k2-0711",
}

# Available models per provider
PROVIDER_MODELS: dict[str, list[dict[str, str]]] = {
    "anthropic": [
        {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4"},
        {"id": "claude-haiku-4-20250514", "name": "Claude Haiku 4"},
        {"id": "claude-opus-4-20250514", "name": "Claude Opus 4"},
    ],
    "openai": [
        {"id": "gpt-4o", "name": "GPT-4o"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
        {"id": "o3-mini", "name": "o3-mini"},
    ],
    "kimi": [
        {"id": "kimi-k2-0711", "name": "Kimi k2.5"},
        {"id": "moonshot-v1-auto", "name": "Moonshot v1 Auto"},
    ],
}


def create_llm_provider(
    provider: str = "anthropic",
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
) -> LLMProvider:
    """Create an LLM provider instance.

    Args:
        provider: Provider name (anthropic, openai, kimi)
        model: Model ID (uses provider default if not specified)
        api_key: API key (uses env var if not specified)
        base_url: Base URL override

    Returns:
        LLMProvider instance
    """
    entry = PROVIDER_REGISTRY.get(provider)
    if not entry:
        logger.warning(f"Unbekannter Provider '{provider}', verwende Anthropic als Fallback")
        entry = PROVIDER_REGISTRY["anthropic"]

    provider_class, default_base_url = entry
    effective_model = model or DEFAULT_MODELS.get(provider, "claude-sonnet-4-20250514")
    effective_base_url = base_url or default_base_url

    return provider_class(
        model=effective_model,
        api_key=api_key,
        base_url=effective_base_url,
    )
