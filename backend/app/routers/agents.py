from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete as delete_stmt, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import AgentInstance, AgentType
from app.models.task import Task
from app.models.project import Project
from app.models.execution import ExecutionStep
from app.schemas.agent import (
    AgentInstanceResponse,
    AgentInstanceWithTaskResponse,
    AgentMessageRequest,
    AgentSpawnRequest,
    AgentSuggestionResponse,
    AgentTypeCreateRequest,
    AgentTypeDetailResponse,
    AgentTypeResponse,
    AgentTypeUpdateRequest,
    ExecutionStepResponse,
)
from app.config import settings
from app.services.agent_service import get_running_agent, launch_agent_task
from app.services.assignment_service import suggest_agents_for_task

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/types", response_model=list[AgentTypeResponse])
async def list_agent_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentType).order_by(AgentType.name))
    return [AgentTypeResponse.model_validate(a) for a in result.scalars().all()]


@router.get("/types/{type_id}", response_model=AgentTypeDetailResponse)
async def get_agent_type(type_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentType).where(AgentType.id == type_id))
    agent_type = result.scalar_one_or_none()
    if not agent_type:
        raise HTTPException(status_code=404, detail="Agent-Typ nicht gefunden")
    return AgentTypeDetailResponse.model_validate(agent_type)


@router.post("/types", response_model=AgentTypeDetailResponse, status_code=201)
async def create_agent_type(
    data: AgentTypeCreateRequest, db: AsyncSession = Depends(get_db)
):
    """Neuen benutzerdefinierten Agent-Typ erstellen."""
    agent_type = AgentType(
        id=f"agent-custom-{str(uuid4())[:8]}",
        name=data.name,
        description=data.description,
        capabilities=data.capabilities,
        tools=data.tools,
        system_prompt=data.system_prompt,
        model=data.model,
        temperature=data.temperature,
        max_tokens=data.max_tokens,
        max_concurrent_instances=data.max_concurrent_instances,
        trust_level=data.trust_level,
        context_scope=data.context_scope,
        provider=data.provider,
        provider_base_url=data.provider_base_url,
        is_custom=True,
    )
    db.add(agent_type)
    await db.commit()
    await db.refresh(agent_type)
    return AgentTypeDetailResponse.model_validate(agent_type)


@router.put("/types/{type_id}", response_model=AgentTypeDetailResponse)
async def update_agent_type(
    type_id: str,
    data: AgentTypeUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Agent-Typ aktualisieren (nur benutzerdefinierte)."""
    result = await db.execute(select(AgentType).where(AgentType.id == type_id))
    agent_type = result.scalar_one_or_none()
    if not agent_type:
        raise HTTPException(status_code=404, detail="Agent-Typ nicht gefunden")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(agent_type, field, value)

    await db.commit()
    await db.refresh(agent_type)
    return AgentTypeDetailResponse.model_validate(agent_type)


@router.delete("/types/{type_id}", status_code=204)
async def delete_agent_type(type_id: str, db: AsyncSession = Depends(get_db)):
    """Benutzerdefinierten Agent-Typ löschen."""
    result = await db.execute(select(AgentType).where(AgentType.id == type_id))
    agent_type = result.scalar_one_or_none()
    if not agent_type:
        raise HTTPException(status_code=404, detail="Agent-Typ nicht gefunden")
    if not agent_type.is_custom:
        raise HTTPException(status_code=403, detail="Eingebaute Agenten können nicht gelöscht werden")
    await db.delete(agent_type)
    await db.commit()


@router.get("/tools/available", response_model=list[dict])
async def list_available_tools():
    """Alle verfügbaren Tools auflisten (für Agent-Konfigurator)."""
    from agents.tools.registry import TOOL_REGISTRY
    return [
        {
            "name": tool.name,
            "description": tool.description,
        }
        for tool in TOOL_REGISTRY.values()
    ]


@router.get("/providers", response_model=list[dict])
async def list_providers():
    """Verfügbare LLM-Provider und deren Modelle auflisten."""
    from agents.llm.factory import PROVIDER_REGISTRY, DEFAULT_MODELS, PROVIDER_MODELS
    return [
        {
            "id": provider_id,
            "name": provider_id.capitalize(),
            "default_model": DEFAULT_MODELS.get(provider_id, ""),
            "models": PROVIDER_MODELS.get(provider_id, []),
        }
        for provider_id in PROVIDER_REGISTRY
    ]


@router.post("/spawn", response_model=AgentInstanceResponse, status_code=201)
async def spawn_agent(data: AgentSpawnRequest, db: AsyncSession = Depends(get_db)):
    # Check API key
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY nicht konfiguriert. Bitte in .env eintragen.",
        )

    # Verify agent type exists
    at_result = await db.execute(
        select(AgentType).where(AgentType.id == data.agent_type_id)
    )
    agent_type = at_result.scalar_one_or_none()
    if not agent_type:
        raise HTTPException(status_code=404, detail="Agent-Typ nicht gefunden")

    # Verify task exists
    task_result = await db.execute(select(Task).where(Task.id == data.task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")

    # Check concurrent instance limit
    count_result = await db.execute(
        select(func.count())
        .select_from(AgentInstance)
        .where(
            AgentInstance.agent_type_id == data.agent_type_id,
            AgentInstance.status.in_(["initializing", "running", "paused"]),
        )
    )
    current_count = count_result.scalar() or 0
    if current_count >= agent_type.max_concurrent_instances:
        raise HTTPException(
            status_code=429,
            detail=f"Max. gleichzeitige Instanzen erreicht ({agent_type.max_concurrent_instances})",
        )

    # Create instance
    instance = AgentInstance(
        id=str(uuid4()),
        agent_type_id=data.agent_type_id,
        task_id=data.task_id,
        status="initializing",
        started_at=datetime.now(UTC),
    )
    db.add(instance)

    # Update task
    task.status = "in_progress"
    task.assignee_agent_type_id = data.agent_type_id

    await db.commit()
    await db.refresh(instance)

    # Launch agent as background task
    launch_agent_task(instance.id)

    return AgentInstanceResponse.model_validate(instance)


@router.get("/instances", response_model=list[AgentInstanceWithTaskResponse])
async def list_agent_instances(
    project_id: str = Query("", description="Filter nach Projekt-ID"),
    status: str = Query("", description="Filter nach Status"),
    db: AsyncSession = Depends(get_db),
):
    """Alle Agent-Instanzen auflisten, optional gefiltert nach Projekt und Status."""
    stmt = (
        select(
            AgentInstance,
            Task.title.label("task_title"),
            AgentType.name.label("agent_type_name"),
            Task.project_id.label("project_id"),
            Project.title.label("project_title"),
        )
        .join(Task, AgentInstance.task_id == Task.id)
        .outerjoin(AgentType, AgentInstance.agent_type_id == AgentType.id)
        .outerjoin(Project, Task.project_id == Project.id)
        .where(AgentInstance.deleted_at.is_(None))
    )

    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    if status:
        stmt = stmt.where(AgentInstance.status == status)

    stmt = stmt.order_by(AgentInstance.started_at.desc()).limit(100)

    result = await db.execute(stmt)
    rows = result.all()

    return [
        AgentInstanceWithTaskResponse(
            **AgentInstanceResponse.model_validate(row[0]).model_dump(),
            task_title=row[1],
            agent_type_name=row[2],
            project_id=row[3],
            project_title=row[4],
        )
        for row in rows
    ]


@router.get("/instances/{instance_id}", response_model=AgentInstanceResponse)
async def get_agent_instance(instance_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentInstance).where(AgentInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Agent-Instanz nicht gefunden")
    return AgentInstanceResponse.model_validate(instance)


@router.post("/instances/{instance_id}/pause", response_model=AgentInstanceResponse)
async def pause_agent(instance_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentInstance).where(AgentInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Agent-Instanz nicht gefunden")
    if instance.status != "running":
        raise HTTPException(status_code=422, detail="Agent läuft nicht")
    instance.status = "paused"
    agent = get_running_agent(instance_id)
    if agent:
        agent.pause()
    await db.commit()
    await db.refresh(instance)
    return AgentInstanceResponse.model_validate(instance)


@router.post("/instances/{instance_id}/resume", response_model=AgentInstanceResponse)
async def resume_agent(instance_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentInstance).where(AgentInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Agent-Instanz nicht gefunden")
    if instance.status != "paused":
        raise HTTPException(status_code=422, detail="Agent ist nicht pausiert")
    instance.status = "running"
    agent = get_running_agent(instance_id)
    if agent:
        agent.resume()
    await db.commit()
    await db.refresh(instance)
    return AgentInstanceResponse.model_validate(instance)


@router.post("/instances/{instance_id}/cancel", response_model=AgentInstanceResponse)
async def cancel_agent(instance_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentInstance).where(AgentInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Agent-Instanz nicht gefunden")
    if instance.status in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=422, detail="Agent ist bereits beendet")
    instance.status = "cancelled"
    instance.completed_at = datetime.now(UTC)
    agent = get_running_agent(instance_id)
    if agent:
        agent.cancel()
    await db.commit()
    await db.refresh(instance)
    return AgentInstanceResponse.model_validate(instance)


@router.post("/instances/{instance_id}/restart", response_model=AgentInstanceResponse, status_code=201)
async def restart_agent(instance_id: str, db: AsyncSession = Depends(get_db)):
    """Beendeten Agent neu starten (erstellt neue Instanz mit gleicher Konfiguration)."""
    # Check API key
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY nicht konfiguriert. Bitte in .env eintragen.",
        )

    result = await db.execute(
        select(AgentInstance).where(AgentInstance.id == instance_id)
    )
    old_instance = result.scalar_one_or_none()
    if not old_instance:
        raise HTTPException(status_code=404, detail="Agent-Instanz nicht gefunden")
    if old_instance.status not in ("completed", "failed", "cancelled"):
        raise HTTPException(
            status_code=422,
            detail="Nur beendete Agenten können neu gestartet werden",
        )

    # Verify task still exists
    task_result = await db.execute(select(Task).where(Task.id == old_instance.task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Zugehöriger Task nicht gefunden")

    # Create new instance
    new_instance = AgentInstance(
        id=str(uuid4()),
        agent_type_id=old_instance.agent_type_id,
        task_id=old_instance.task_id,
        status="initializing",
        started_at=datetime.now(UTC),
    )
    db.add(new_instance)

    # Reset task status
    task.status = "in_progress"

    await db.commit()
    await db.refresh(new_instance)

    # Launch agent as background task
    launch_agent_task(new_instance.id)

    return AgentInstanceResponse.model_validate(new_instance)


@router.delete("/instances/{instance_id}", status_code=204)
async def delete_agent_instance(instance_id: str, db: AsyncSession = Depends(get_db)):
    """Agent-Instanz soft-deleten (Kosten bleiben erhalten)."""
    result = await db.execute(
        select(AgentInstance).where(
            AgentInstance.id == instance_id,
            AgentInstance.deleted_at.is_(None),
        )
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Agent-Instanz nicht gefunden")
    # Cancel if still running
    if instance.status in ("initializing", "running", "paused", "waiting_input"):
        agent = get_running_agent(instance_id)
        if agent:
            agent.cancel()
        instance.status = "cancelled"
    # Soft-delete: mark as deleted, keep ExecutionSteps for cost tracking
    instance.deleted_at = datetime.now(UTC)
    # Clean up non-cost-relevant related records
    from app.models.approval import Approval
    from app.models.tracks import TrackPoint
    await db.execute(
        delete_stmt(Approval).where(Approval.agent_instance_id == instance_id)
    )
    await db.execute(
        delete_stmt(TrackPoint).where(TrackPoint.agent_instance_id == instance_id)
    )
    await db.commit()


@router.post("/instances/{instance_id}/message", response_model=AgentInstanceResponse)
async def send_message_to_agent(
    instance_id: str,
    data: AgentMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentInstance).where(AgentInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Agent-Instanz nicht gefunden")
    if instance.status not in ("running", "paused", "waiting_input"):
        raise HTTPException(status_code=422, detail="Agent akzeptiert keine Nachrichten")
    agent = get_running_agent(instance_id)
    if agent:
        agent.add_message(data.message)
    return AgentInstanceResponse.model_validate(instance)


@router.get("/suggest/{task_id}", response_model=list[AgentSuggestionResponse])
async def suggest_agent(task_id: str, db: AsyncSession = Depends(get_db)):
    suggestions = await suggest_agents_for_task(db, task_id)
    return [
        AgentSuggestionResponse(
            agent_type_id=s.agent_type_id,
            agent_type_name=s.agent_type_name,
            confidence=s.confidence,
            reason=s.reason,
        )
        for s in suggestions
    ]


@router.get(
    "/instances/{instance_id}/steps",
    response_model=list[ExecutionStepResponse],
)
async def list_execution_steps(
    instance_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ExecutionStep)
        .where(ExecutionStep.agent_instance_id == instance_id)
        .order_by(ExecutionStep.step_number)
    )
    return [ExecutionStepResponse.model_validate(s) for s in result.scalars().all()]


@router.get(
    "/instances/{instance_id}/children",
    response_model=list[AgentInstanceResponse],
)
async def list_child_instances(
    instance_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AgentInstance)
        .where(AgentInstance.parent_instance_id == instance_id)
        .order_by(AgentInstance.started_at)
    )
    return [AgentInstanceResponse.model_validate(i) for i in result.scalars().all()]
