"""Planning workflow service — orchestrates the KI planning wizard lifecycle."""

import asyncio
import json
import logging
import sys
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth import DEFAULT_USER_ID
from app.models.agent import AgentInstance, AgentType
from app.models.planning_session import PlanningSession
from app.models.project import Project
from app.models.task import Task
from app.schemas.planning_session import (
    ConfirmPlanRequest,
    PlanTaskSuggestion,
)
from app.services.exa_search import auto_generate_search_topics, get_exa_api_key, search_exa
from app.services.notification_service import create_notification
from app.services.task_service import record_history
from app.sse.manager import sse_manager

# Add project root to path so we can import agents
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

logger = logging.getLogger(__name__)

WORKFLOW_PLANNING_AGENT_ID = "agent-workflow-planning-001"


async def create_session(
    db: AsyncSession,
    project_id: str,
    input_mode: str,
    user_id: str = DEFAULT_USER_ID,
) -> PlanningSession:
    """Create a new planning session."""
    # Verify project exists
    project = await db.get(Project, project_id)
    if not project:
        raise ValueError("Projekt nicht gefunden")

    session = PlanningSession(
        id=str(uuid4()),
        project_id=project_id,
        user_id=user_id,
        status="input",
        input_mode=input_mode,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_session(db: AsyncSession, session_id: str) -> PlanningSession | None:
    """Get a planning session by ID."""
    return await db.get(PlanningSession, session_id)


async def update_session_input(
    db: AsyncSession,
    session_id: str,
    user_notes: str | None = None,
    knowledge_doc_ids: list[str] | None = None,
    web_search_topics: list[str] | None = None,
    auto_context: bool = False,
) -> PlanningSession:
    """Update the input configuration of a planning session."""
    session = await db.get(PlanningSession, session_id)
    if not session:
        raise ValueError("Planungssitzung nicht gefunden")

    if session.status not in ("input", "review"):
        raise ValueError("Planungssitzung ist nicht im Eingabe-Modus")

    if user_notes is not None:
        session.user_notes = user_notes
    if knowledge_doc_ids is not None:
        session.knowledge_doc_ids = json.dumps(knowledge_doc_ids)
    if web_search_topics is not None:
        session.web_search_topics = json.dumps(web_search_topics)
    session.auto_context = auto_context

    await db.commit()
    await db.refresh(session)
    return session


async def execute_web_search(
    db: AsyncSession,
    session_id: str,
    topics: list[str],
) -> list[dict]:
    """Execute Exa.ai web search for the given topics."""
    session = await db.get(PlanningSession, session_id)
    if not session:
        raise ValueError("Planungssitzung nicht gefunden")

    # Get Exa API key
    api_key = await get_exa_api_key(db)
    if not api_key:
        raise ValueError(
            "Kein Exa API-Key konfiguriert. "
            "Bitte hinterlege einen Exa API-Key im Profil unter API-Schlüssel."
        )

    # If auto_context, generate topics from project
    if not topics and session.auto_context:
        project = await db.get(Project, session.project_id)
        if project:
            topics = await auto_generate_search_topics(
                project_title=project.title,
                project_description=project.description,
                project_goal=project.goal,
            )

    if not topics:
        raise ValueError("Keine Suchthemen angegeben")

    session.status = "searching"
    session.web_search_topics = json.dumps(topics)
    await db.commit()

    # Execute search
    results = await search_exa(topics=topics, api_key=api_key)

    # Store results
    session.web_search_results = json.dumps(results)
    session.status = "input"  # Back to input after search
    await db.commit()
    await db.refresh(session)

    return results


async def generate_plan(
    db: AsyncSession,
    session_id: str,
    session_factory: async_sessionmaker,
) -> PlanningSession:
    """Start plan generation using the WorkflowPlanningAgent.

    Returns the session with agent_instance_id for SSE streaming.
    """
    session = await db.get(PlanningSession, session_id)
    if not session:
        raise ValueError("Planungssitzung nicht gefunden")

    project = await db.get(Project, session.project_id)
    if not project:
        raise ValueError("Projekt nicht gefunden")

    # Build context from all input sources
    context_parts: list[str] = []

    # Project info
    context_parts.append(f"## Projekt: {project.title}")
    if project.description:
        context_parts.append(f"Beschreibung: {project.description}")
    if project.goal:
        context_parts.append(f"Ziel: {project.goal}")

    # User notes
    if session.user_notes:
        context_parts.append(f"\n## Benutzer-Anmerkungen\n{session.user_notes}")

    # Web search results
    if session.web_search_results:
        try:
            web_results = json.loads(session.web_search_results)
            if web_results:
                context_parts.append("\n## Web-Recherche-Ergebnisse")
                for r in web_results[:10]:
                    context_parts.append(f"- **{r['title']}** ({r['url']})\n  {r['snippet'][:200]}")
        except json.JSONDecodeError:
            pass

    # Existing tasks as context
    existing_tasks_result = await db.execute(
        select(Task).where(Task.project_id == session.project_id)
    )
    existing_tasks = list(existing_tasks_result.scalars().all())
    if existing_tasks:
        context_parts.append("\n## Bestehende Tasks im Projekt")
        for t in existing_tasks:
            context_parts.append(f"- [{t.status}] {t.title} (Prioritaet: {t.priority})")

    full_context = "\n".join(context_parts)

    # Get agent type
    agent_type_result = await db.execute(
        select(AgentType).where(AgentType.id == WORKFLOW_PLANNING_AGENT_ID)
    )
    agent_type = agent_type_result.scalar_one_or_none()
    if not agent_type:
        raise ValueError("Workflow-Planning-Agent nicht gefunden. Bitte Server neu starten.")

    # Create a temporary planning task
    planning_task = Task(
        id=str(uuid4()),
        project_id=session.project_id,
        title=f"KI-Planung: {project.title}",
        description=f"Automatische Planungssitzung fuer Projekt '{project.title}'",
        status="in_progress",
        priority="medium",
        created_by=session.user_id,
    )
    db.add(planning_task)

    # Create agent instance
    instance = AgentInstance(
        id=str(uuid4()),
        agent_type_id=WORKFLOW_PLANNING_AGENT_ID,
        task_id=planning_task.id,
        status="initializing",
    )
    db.add(instance)

    # Update session
    session.status = "generating"
    session.agent_instance_id = instance.id

    await db.commit()
    await db.refresh(session)

    # Launch agent in background
    asyncio.create_task(_run_planning_agent(
        instance_id=instance.id,
        agent_type=agent_type,
        task=planning_task,
        project=project,
        additional_context=full_context,
        knowledge_doc_ids=json.loads(session.knowledge_doc_ids) if session.knowledge_doc_ids else [],
        session_factory=session_factory,
        planning_session_id=session_id,
    ))

    return session


async def _run_planning_agent(
    instance_id: str,
    agent_type: AgentType,
    task: Task,
    project: Project,
    additional_context: str,
    knowledge_doc_ids: list[str],
    session_factory: async_sessionmaker,
    planning_session_id: str,
):
    """Run the planning agent and update the session with results."""
    from agents.briefing import TaskBriefing
    from agents.registry import get_agent_class
    from app.services.context_selection import select_context

    briefing = TaskBriefing(
        task_id=task.id,
        task_title=task.title,
        task_description=task.description or "",
        project_id=task.project_id,
        project_title=project.title,
        project_goal=project.goal or "",
        autonomy_level="full_auto",  # No approval needed for plan generation
        additional_context=additional_context,
        agent_name=agent_type.name,
        provider=getattr(agent_type, "provider", "anthropic"),
        model=agent_type.model or "claude-sonnet-4-20250514",
        temperature=agent_type.temperature or 0.3,
        max_tokens=agent_type.max_tokens or 4096,
        system_prompt=agent_type.system_prompt,
        tools_json=agent_type.tools,
    )

    # Inject knowledge context
    try:
        ctx = await select_context(
            task_title=briefing.task_title,
            task_description=briefing.task_description,
            project_id=briefing.project_id,
            project_goal=briefing.project_goal,
            user_id=DEFAULT_USER_ID,
            session_factory=session_factory,
            token_budget=3000,
        )
        if ctx.context_text:
            briefing.additional_context = (briefing.additional_context or "") + "\n\n" + ctx.context_text
    except Exception:
        pass

    agent_class = get_agent_class(WORKFLOW_PLANNING_AGENT_ID)
    if not agent_class:
        logger.error("WorkflowPlanningAgent nicht in Registry gefunden")
        return

    agent = agent_class(
        instance_id=instance_id,
        briefing=briefing,
        session_factory=session_factory,
        sse_manager=sse_manager,
    )

    try:
        await agent.execute()

        # After agent completes, parse the output and update planning session
        async with session_factory() as db:
            # Get the agent output
            inst = await db.get(AgentInstance, instance_id)
            if inst and inst.status == "completed":
                # Get the task output
                from app.models.output import TaskOutput
                output_result = await db.execute(
                    select(TaskOutput)
                    .where(TaskOutput.task_id == task.id)
                    .order_by(TaskOutput.version.desc())
                )
                output = output_result.scalar_one_or_none()

                planning_session = await db.get(PlanningSession, planning_session_id)
                if planning_session and output and output.content:
                    planning_session.generated_plan = output.content
                    planning_session.status = "review"
                    await db.commit()

    except Exception as e:
        logger.error("Planning agent fehlgeschlagen: %s", str(e))
        async with session_factory() as db:
            planning_session = await db.get(PlanningSession, planning_session_id)
            if planning_session:
                planning_session.status = "input"  # Allow retry
                await db.commit()


async def confirm_plan(
    db: AsyncSession,
    session_id: str,
    request: ConfirmPlanRequest,
    session_factory: async_sessionmaker,
) -> list[Task]:
    """Confirm the plan and create tasks in a single transaction."""
    planning_session = await db.get(PlanningSession, session_id)
    if not planning_session:
        raise ValueError("Planungssitzung nicht gefunden")

    if planning_session.status != "review":
        raise ValueError("Planungssitzung ist nicht im Review-Modus")

    project = await db.get(Project, planning_session.project_id)
    if not project:
        raise ValueError("Projekt nicht gefunden")

    # Get max sort_order for the project
    existing_result = await db.execute(
        select(Task.sort_order)
        .where(Task.project_id == planning_session.project_id)
        .order_by(Task.sort_order.desc())
    )
    max_sort = existing_result.scalar() or 0

    created_tasks: list[Task] = []

    for i, task_suggestion in enumerate(request.tasks):
        task = Task(
            id=str(uuid4()),
            project_id=planning_session.project_id,
            title=task_suggestion.title,
            description=task_suggestion.description,
            acceptance_criteria=task_suggestion.acceptance_criteria,
            status="todo",
            priority=task_suggestion.priority or "medium",
            assignee_agent_type_id=task_suggestion.agent_type_id,
            estimated_duration_minutes=task_suggestion.estimated_duration_minutes,
            tags=task_suggestion.tags,
            sort_order=max_sort + i + 1,
            created_by=planning_session.user_id,
        )
        db.add(task)
        created_tasks.append(task)

        # Record audit trail
        await record_history(
            session=db,
            task_id=task.id,
            field_name="status",
            old_value=None,
            new_value="todo",
            changed_by_type="system",
            changed_by_id=f"planning_session:{session_id}",
        )

    # Store confirmed plan
    confirmed = [t.model_dump() for t in request.tasks]
    planning_session.confirmed_plan = json.dumps(confirmed)
    planning_session.status = "confirmed"

    # Create notification
    await create_notification(
        session=db,
        type="plan_confirmed",
        title="KI-Plan erstellt",
        message=f"KI-Plan fuer '{project.title}' erstellt: {len(created_tasks)} Tasks angelegt.",
        link=f"/projects/{planning_session.project_id}",
        priority="info",
    )

    # Clean up temporary planning task
    if planning_session.agent_instance_id:
        inst = await db.get(AgentInstance, planning_session.agent_instance_id)
        if inst:
            temp_task = await db.get(Task, inst.task_id)
            if temp_task and temp_task.title.startswith("KI-Planung:"):
                temp_task.status = "done"

    await db.commit()

    # Refresh all created objects so server-generated fields (updated_at etc.) are loaded
    await db.refresh(planning_session)
    for task in created_tasks:
        await db.refresh(task)

    # Auto-start agents if requested
    if request.auto_start_agents:
        for task in created_tasks:
            if task.assignee_agent_type_id:
                try:
                    await _spawn_agent_for_task(
                        db=db,
                        task=task,
                        agent_type_id=task.assignee_agent_type_id,
                        session_factory=session_factory,
                    )
                except Exception as e:
                    logger.warning(
                        "Auto-Start Agent fuer Task '%s' fehlgeschlagen: %s",
                        task.title, str(e),
                    )

    return created_tasks


async def _spawn_agent_for_task(
    db: AsyncSession,
    task: Task,
    agent_type_id: str,
    session_factory: async_sessionmaker,
):
    """Spawn an agent instance for a task (used for auto-start)."""
    from app.services.agent_service import launch_agent_task

    instance = AgentInstance(
        id=str(uuid4()),
        agent_type_id=agent_type_id,
        task_id=task.id,
        status="initializing",
    )
    db.add(instance)
    task.status = "in_progress"
    await db.commit()

    launch_agent_task(instance.id)


async def cancel_session(db: AsyncSession, session_id: str) -> None:
    """Cancel a planning session and clean up."""
    planning_session = await db.get(PlanningSession, session_id)
    if not planning_session:
        raise ValueError("Planungssitzung nicht gefunden")

    if planning_session.status == "confirmed":
        raise ValueError("Bestaetigte Planungssitzung kann nicht abgebrochen werden")

    # Cancel running agent if any
    if planning_session.agent_instance_id:
        inst = await db.get(AgentInstance, planning_session.agent_instance_id)
        if inst and inst.status in ("initializing", "running"):
            from app.services.agent_service import get_running_agent
            agent = get_running_agent(planning_session.agent_instance_id)
            if agent:
                await agent.cancel()

        # Clean up temp task
        if inst:
            temp_task = await db.get(Task, inst.task_id)
            if temp_task and temp_task.title.startswith("KI-Planung:"):
                await db.delete(temp_task)

    planning_session.status = "cancelled"
    await db.commit()
