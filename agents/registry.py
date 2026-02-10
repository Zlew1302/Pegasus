from agents.base import BaseAgent
from agents.research.agent import ResearchAgent

AGENT_REGISTRY: dict[str, type[BaseAgent]] = {
    "agent-research-001": ResearchAgent,
}


def get_agent_class(agent_type_id: str) -> type[BaseAgent] | None:
    return AGENT_REGISTRY.get(agent_type_id)
