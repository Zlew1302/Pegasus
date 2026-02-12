from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import AgentInstance, AgentType
from app.models.task import Task
from app.models.execution import ExecutionStep
from app.schemas.agent import (
    AgentInstanceResponse,
    AgentMessageRequest,
    AgentSpawnRequest,
    AgentSuggestionResponse,
    AgentTypeResponse,
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


@router.get("/types/{type_id}", response_model=AgentTypeResponse)
async def get_agent_type(type_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentType).where(AgentType.id == type_id))
    agent_type = result.scalar_one_or_none()
    if not agent_type:
        raise HTTPException(status_code=404, detail="Agent-Typ nicht gefunden")
    return AgentTypeResponse.model_validate(agent_type)


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
        raise HTTPException(status_code=422, detail="Agent laeuft nicht")
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
