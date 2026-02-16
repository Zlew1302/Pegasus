"""Orchestrator router — starts the orchestrator agent for user requests."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.services.orchestrator_service import start_orchestration

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/orchestrator", tags=["orchestrator"])


class OrchestratorStartRequest(BaseModel):
    project_id: str
    instruction: str


class OrchestratorStartResponse(BaseModel):
    instance_id: str
    task_id: str


@router.post("/start", response_model=OrchestratorStartResponse)
async def start_orchestrator(
    data: OrchestratorStartRequest,
    db: AsyncSession = Depends(get_db),
):
    """Starte den Orchestrator für eine Benutzeranfrage.

    Gibt die AgentInstance-ID zurück, über die der SSE-Stream abonniert werden kann.
    """
    if not data.instruction.strip():
        raise HTTPException(400, "Anweisung darf nicht leer sein")

    try:
        instance = await start_orchestration(
            db=db,
            project_id=data.project_id,
            user_instruction=data.instruction.strip(),
            session_factory=async_session,
        )
        return OrchestratorStartResponse(
            instance_id=instance.id,
            task_id=instance.task_id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
