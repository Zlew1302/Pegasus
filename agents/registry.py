from agents.base import BaseAgent
from agents.planning.agent import PlanningAgent
from agents.research.agent import ResearchAgent
from agents.writing.agent import WritingAgent
from agents.qa.agent import QAAgent

AGENT_REGISTRY: dict[str, type[BaseAgent]] = {
    "agent-research-001": ResearchAgent,
    "agent-planning-001": PlanningAgent,
    "agent-writing-001": WritingAgent,
    "agent-qa-001": QAAgent,
}


def get_agent_class(agent_type_id: str) -> type[BaseAgent] | None:
    return AGENT_REGISTRY.get(agent_type_id)
