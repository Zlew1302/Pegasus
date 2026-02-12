"""Auto-assignment engine — suggests best-fit agents for tasks."""

import json
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import AgentType
from app.models.task import Task


@dataclass
class AgentSuggestion:
    agent_type_id: str
    agent_type_name: str
    confidence: int  # 0-100
    reason: str


# Keyword → agent capability mapping
KEYWORD_CAPABILITY_MAP = {
    "recherche": "web_research",
    "research": "web_research",
    "analyse": "analysis",
    "vergleich": "comparison",
    "zusammenfassung": "summarization",
    "planung": "task_decomposition",
    "plan": "planning",
    "aufteilen": "task_decomposition",
    "zerlegen": "task_decomposition",
    "subtask": "task_decomposition",
    "teilaufgabe": "task_decomposition",
    "schaetzung": "estimation",
    "estimation": "estimation",
    "abhaengigkeit": "dependency_analysis",
}

# Task tags → capabilities
TAG_CAPABILITY_MAP = {
    "RESEARCH": ["web_research", "analysis", "summarization"],
    "ANALYSE": ["analysis", "comparison"],
    "PLANNING": ["task_decomposition", "planning", "estimation"],
    "PLANUNG": ["task_decomposition", "planning"],
}


async def suggest_agents_for_task(
    session: AsyncSession, task_id: str
) -> list[AgentSuggestion]:
    """Score all agent types against a task and return sorted suggestions."""
    task = await session.get(Task, task_id)
    if not task:
        return []

    result = await session.execute(select(AgentType))
    agent_types = result.scalars().all()

    suggestions: list[AgentSuggestion] = []

    for at in agent_types:
        score, reasons = _score_agent_for_task(at, task)
        if score > 0:
            suggestions.append(AgentSuggestion(
                agent_type_id=at.id,
                agent_type_name=at.name,
                confidence=min(score, 100),
                reason="; ".join(reasons),
            ))

    suggestions.sort(key=lambda s: s.confidence, reverse=True)
    return suggestions


def _score_agent_for_task(agent_type: AgentType, task: Task) -> tuple[int, list[str]]:
    """Calculate match score between agent type and task."""
    score = 0
    reasons: list[str] = []

    # Parse capabilities
    capabilities: list[str] = []
    if agent_type.capabilities:
        try:
            capabilities = json.loads(agent_type.capabilities)
        except (json.JSONDecodeError, TypeError):
            pass

    # 1. Tag matching (highest weight: +30 per matching tag)
    task_tags: list[str] = []
    if task.tags:
        try:
            task_tags = json.loads(task.tags)
        except (json.JSONDecodeError, TypeError):
            pass

    for tag in task_tags:
        tag_upper = tag.upper()
        if tag_upper in TAG_CAPABILITY_MAP:
            required_caps = TAG_CAPABILITY_MAP[tag_upper]
            matching = [c for c in required_caps if c in capabilities]
            if matching:
                score += 30
                reasons.append(f"Tag '{tag}' passt zu Faehigkeiten")

    # 2. Task type matching (+25)
    if task.task_type:
        task_type_lower = task.task_type.lower()
        if task_type_lower in ("research", "recherche") and "web_research" in capabilities:
            score += 25
            reasons.append("Task-Typ 'Research' passt")
        elif task_type_lower in ("planning", "planung") and "task_decomposition" in capabilities:
            score += 25
            reasons.append("Task-Typ 'Planning' passt")

    # 3. Keyword matching in title + description (+15 per keyword)
    text = f"{task.title or ''} {task.description or ''}".lower()
    matched_keywords: set[str] = set()
    for keyword, capability in KEYWORD_CAPABILITY_MAP.items():
        if keyword in text and capability in capabilities and keyword not in matched_keywords:
            matched_keywords.add(keyword)
            score += 15
            reasons.append(f"Keyword '{keyword}' gefunden")

    # 4. Base confidence if agent has any relevant capabilities (+10)
    if score > 0:
        score += 10
        reasons.append(f"{agent_type.name} hat passende Faehigkeiten")

    return score, reasons
