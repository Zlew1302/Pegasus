"""Orchestrator Service — startet den Orchestrator-Agent für User-Anfragen."""

import asyncio
import json
import logging
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth import DEFAULT_USER_ID
from app.models.agent import AgentInstance, AgentType
from app.models.project import Project
from app.models.task import Task
from app.services.context_selection import select_context
from app.sse.manager import sse_manager

logger = logging.getLogger(__name__)

ORCHESTRATOR_AGENT_ID = "agent-orchestrator-001"


async def start_orchestration(
    db: AsyncSession,
    project_id: str,
    user_instruction: str,
    session_factory: async_sessionmaker,
    user_id: str = DEFAULT_USER_ID,
) -> AgentInstance:
    """Starte den Orchestrator für eine Benutzeranfrage.

    Erstellt einen Task und eine AgentInstance, startet den Agent im Hintergrund
    und gibt die Instance zurück (für SSE-Streaming).
    """
    # Projekt prüfen
    project = await db.get(Project, project_id)
    if not project:
        raise ValueError("Projekt nicht gefunden")

    # Agent-Typ prüfen
    agent_type_result = await db.execute(
        select(AgentType).where(AgentType.id == ORCHESTRATOR_AGENT_ID)
    )
    agent_type = agent_type_result.scalar_one_or_none()
    if not agent_type:
        raise ValueError(
            "Orchestrator-Agent nicht gefunden. Bitte Server neu starten."
        )

    # Task erstellen
    task_title = f"Orchestrator: {user_instruction[:80]}"
    task = Task(
        id=str(uuid4()),
        project_id=project_id,
        title=task_title,
        description=user_instruction,
        status="in_progress",
        priority="medium",
        created_by=user_id,
    )
    db.add(task)

    # AgentInstance erstellen
    instance = AgentInstance(
        id=str(uuid4()),
        agent_type_id=ORCHESTRATOR_AGENT_ID,
        task_id=task.id,
        status="initializing",
    )
    db.add(instance)

    await db.commit()
    await db.refresh(instance)
    await db.refresh(task)

    # Agent im Hintergrund starten
    asyncio.create_task(_run_orchestrator(
        instance_id=instance.id,
        agent_type=agent_type,
        task=task,
        project=project,
        user_instruction=user_instruction,
        session_factory=session_factory,
    ))

    return instance


async def _run_orchestrator(
    instance_id: str,
    agent_type: AgentType,
    task: Task,
    project: Project,
    user_instruction: str,
    session_factory: async_sessionmaker,
):
    """Führe den Orchestrator-Agent aus."""
    from agents.briefing import TaskBriefing
    from agents.registry import get_agent_class

    # Kontext sammeln
    additional_context = ""
    try:
        ctx = await select_context(
            task_title=task.title,
            task_description=user_instruction,
            project_id=project.id,
            project_goal=project.goal or "",
            user_id=DEFAULT_USER_ID,
            session_factory=session_factory,
            token_budget=4000,
        )
        if ctx.context_text:
            additional_context = ctx.context_text
    except Exception as e:
        logger.warning("Kontext-Selektion fehlgeschlagen: %s", str(e))

    # Bestehende Tasks als Kontext
    try:
        async with session_factory() as db:
            from sqlalchemy import select as sa_select
            tasks_result = await db.execute(
                sa_select(Task).where(
                    Task.project_id == project.id,
                    Task.status.notin_(["done", "cancelled"]),
                )
            )
            existing_tasks = list(tasks_result.scalars().all())
            if existing_tasks:
                task_lines = ["\n## Bestehende offene Tasks"]
                for t in existing_tasks[:20]:
                    task_lines.append(
                        f"- [{t.status}] {t.title} (Priorität: {t.priority})"
                    )
                additional_context += "\n".join(task_lines)
    except Exception as e:
        logger.warning("Bestehende Tasks konnten nicht geladen werden: %s", str(e))

    # Alle Standard-Tools + delegate_to_agent
    all_tool_names = [
        "read_project_context",
        "search_knowledge",
        "manage_task",
        "web_search",
        "delegate_to_agent",
    ]

    briefing = TaskBriefing(
        task_id=task.id,
        task_title=task.title,
        task_description=user_instruction,
        project_id=project.id,
        project_title=project.title,
        project_goal=project.goal or "",
        autonomy_level="full_auto",
        additional_context=additional_context,
        agent_name=agent_type.name,
        provider=getattr(agent_type, "provider", "anthropic"),
        model=agent_type.model or "claude-sonnet-4-20250514",
        temperature=agent_type.temperature or 0.3,
        max_tokens=agent_type.max_tokens or 8192,
        system_prompt=agent_type.system_prompt,
        tools_json=json.dumps(all_tool_names),
    )

    agent_class = get_agent_class(ORCHESTRATOR_AGENT_ID)
    if not agent_class:
        logger.error("OrchestratorAgent nicht in Registry gefunden")
        return

    agent = agent_class(
        instance_id=instance_id,
        briefing=briefing,
        session_factory=session_factory,
        sse_manager=sse_manager,
    )

    try:
        await agent.execute()
    except Exception as e:
        logger.error("Orchestrator fehlgeschlagen: %s", str(e))
