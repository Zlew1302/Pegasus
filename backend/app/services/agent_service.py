"""Agent lifecycle management — spawning and running agents."""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.agent import AgentInstance, AgentType
from app.models.project import Project
from app.models.task import Task
from app.sse.manager import sse_manager

# Add project root to path so we can import agents
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from agents.briefing import TaskBriefing  # noqa: E402
from agents.registry import get_agent_class  # noqa: E402

# Track running agent tasks for pause/cancel
_running_agents: dict[str, "BaseAgent"] = {}  # noqa: F821


async def start_agent(instance_id: str):
    """Start an agent instance execution as a background task."""
    async with async_session() as session:
        # Load instance + agent type + task + project
        inst_result = await session.execute(
            select(AgentInstance).where(AgentInstance.id == instance_id)
        )
        instance = inst_result.scalar_one_or_none()
        if not instance:
            return

        at_result = await session.execute(
            select(AgentType).where(AgentType.id == instance.agent_type_id)
        )
        agent_type = at_result.scalar_one_or_none()
        if not agent_type:
            return

        task_result = await session.execute(
            select(Task).where(Task.id == instance.task_id)
        )
        task = task_result.scalar_one_or_none()
        if not task:
            return

        project_result = await session.execute(
            select(Project).where(Project.id == task.project_id)
        )
        project = project_result.scalar_one_or_none()

        # Build briefing
        briefing = TaskBriefing(
            task_id=task.id,
            task_title=task.title,
            task_description=task.description or "",
            acceptance_criteria=task.acceptance_criteria,
            project_title=project.title if project else "",
            project_goal=project.goal or "" if project else "",
            autonomy_level=task.autonomy_level,
        )

    # Get agent class
    agent_class = get_agent_class(agent_type.id)
    if not agent_class:
        return

    # Create and run agent
    agent = agent_class(
        instance_id=instance_id,
        briefing=briefing,
        session_factory=async_session,
        sse_manager=sse_manager,
    )

    _running_agents[instance_id] = agent
    try:
        await agent.execute()
    finally:
        _running_agents.pop(instance_id, None)


def get_running_agent(instance_id: str):
    return _running_agents.get(instance_id)


def launch_agent_task(instance_id: str):
    """Fire-and-forget launch of an agent."""
    asyncio.create_task(start_agent(instance_id))
