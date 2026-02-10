from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import AgentInstance, AgentType
from app.models.task import Task
from app.schemas.agent import (
    AgentInstanceResponse,
    AgentMessageRequest,
    AgentSpawnRequest,
    AgentTypeResponse,
)

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
        started_at=datetime.utcnow(),
    )
    db.add(instance)

    # Update task
    task.status = "in_progress"
    task.assignee_agent_type_id = data.agent_type_id

    await db.commit()
    await db.refresh(instance)

    # Agent execution will be started by the caller (agent_service)
    # This endpoint just creates the instance record

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
    instance.completed_at = datetime.utcnow()
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

    # Message will be picked up by the agent's message queue
    # For now, we just acknowledge receipt
    return AgentInstanceResponse.model_validate(instance)
