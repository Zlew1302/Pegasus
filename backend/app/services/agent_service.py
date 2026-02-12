"""Agent lifecycle management — spawning and running agents."""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import DEFAULT_USER_ID
from app.database import async_session
from app.models.agent import AgentInstance, AgentType
from app.models.project import Project
from app.models.task import Task
from app.sse.manager import sse_manager

# Add project root to path so we can import agents
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from agents.briefing import TaskBriefing  # noqa: E402
from agents.registry import get_agent_class  # noqa: E402
from app.services.context_selection import select_context  # noqa: E402

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

        # Build briefing with agent config
        briefing = TaskBriefing(
            task_id=task.id,
            task_title=task.title,
            task_description=task.description or "",
            acceptance_criteria=task.acceptance_criteria,
            project_id=task.project_id,
            project_title=project.title if project else "",
            project_goal=project.goal or "" if project else "",
            autonomy_level=task.autonomy_level,
            agent_name=agent_type.name,
            model=agent_type.model or "claude-sonnet-4-20250514",
            temperature=agent_type.temperature or 0.3,
            max_tokens=agent_type.max_tokens or 4096,
            system_prompt=agent_type.system_prompt,
            tools_json=agent_type.tools,
        )

    # Inject relevant knowledge context into briefing
    try:
        ctx = await select_context(
            task_title=briefing.task_title,
            task_description=briefing.task_description,
            acceptance_criteria=briefing.acceptance_criteria,
            project_id=briefing.project_id,
            project_goal=briefing.project_goal,
            user_id=briefing.user_id,
            session_factory=async_session,
            token_budget=2000,
        )
        if ctx.context_text:
            briefing.additional_context = ctx.context_text
    except Exception:
        pass  # Context selection is optional, don't block agent start

    # Inject Decision Track workflow suggestions into briefing
    try:
        from app.services.track_service import get_workflow_suggestions
        suggestions = await get_workflow_suggestions(
            session_factory=async_session,
            task_title=briefing.task_title,
            task_description=briefing.task_description,
            project_id=briefing.project_id,
            limit=3,
        )
        if suggestions:
            wf = "\n\n## Gelernte Arbeitsablaeufe\n"
            wf += "Basierend auf frueheren Tasks wurden folgende Muster erkannt:\n"
            for s in suggestions:
                wf += f"- **{s['label']}** (Konfidenz: {s['confidence']}, {s['frequency']}x beobachtet)\n"
            briefing.additional_context = (briefing.additional_context or "") + wf
    except Exception:
        pass  # Workflow suggestions are optional

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


async def _revise_agent(instance_id: str, feedback: str):
    """Resume an agent with feedback for revision."""
    async with async_session() as session:
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

        briefing = TaskBriefing(
            task_id=task.id,
            task_title=task.title,
            task_description=task.description or "",
            acceptance_criteria=task.acceptance_criteria,
            project_id=task.project_id,
            project_title=project.title if project else "",
            project_goal=project.goal or "" if project else "",
            autonomy_level=task.autonomy_level,
            agent_name=agent_type.name,
            model=agent_type.model or "claude-sonnet-4-20250514",
            temperature=agent_type.temperature or 0.3,
            max_tokens=agent_type.max_tokens or 4096,
            system_prompt=agent_type.system_prompt,
            tools_json=agent_type.tools,
        )

    # Inject relevant knowledge context into briefing
    try:
        ctx = await select_context(
            task_title=briefing.task_title,
            task_description=briefing.task_description,
            acceptance_criteria=briefing.acceptance_criteria,
            project_id=briefing.project_id,
            project_goal=briefing.project_goal,
            user_id=briefing.user_id,
            session_factory=async_session,
            token_budget=2000,
        )
        if ctx.context_text:
            briefing.additional_context = ctx.context_text
    except Exception:
        pass  # Context selection is optional, don't block agent revision

    # Inject Decision Track workflow suggestions into briefing
    try:
        from app.services.track_service import get_workflow_suggestions
        suggestions = await get_workflow_suggestions(
            session_factory=async_session,
            task_title=briefing.task_title,
            task_description=briefing.task_description,
            project_id=briefing.project_id,
            limit=3,
        )
        if suggestions:
            wf = "\n\n## Gelernte Arbeitsablaeufe\n"
            wf += "Basierend auf frueheren Tasks wurden folgende Muster erkannt:\n"
            for s in suggestions:
                wf += f"- **{s['label']}** (Konfidenz: {s['confidence']}, {s['frequency']}x beobachtet)\n"
            briefing.additional_context = (briefing.additional_context or "") + wf
    except Exception:
        pass  # Workflow suggestions are optional

    agent_class = get_agent_class(agent_type.id)
    if not agent_class:
        return

    agent = agent_class(
        instance_id=instance_id,
        briefing=briefing,
        session_factory=async_session,
        sse_manager=sse_manager,
    )

    _running_agents[instance_id] = agent
    try:
        await agent.revise(feedback)
    finally:
        _running_agents.pop(instance_id, None)


def resume_agent_with_feedback(instance_id: str, feedback: str):
    """Fire-and-forget launch of agent revision."""
    asyncio.create_task(_revise_agent(instance_id, feedback))
