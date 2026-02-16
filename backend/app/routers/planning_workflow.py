"""Router for the KI planning workflow."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import async_session, get_db
from app.schemas.planning_session import (
    ConfirmPlanRequest,
    ExaSearchRequest,
    ExaSearchResult,
    PlanningSessionCreate,
    PlanningSessionInputUpdate,
    PlanningSessionResponse,
)
from app.schemas.task import TaskResponse
from app.services import planning_workflow_service as service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/planning", tags=["planning"])


@router.post("/sessions", response_model=PlanningSessionResponse, status_code=201)
async def create_session(
    data: PlanningSessionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Neue Planungssitzung erstellen."""
    try:
        session = await service.create_session(
            db=db,
            project_id=data.project_id,
            input_mode=data.input_mode,
            user_id=user_id,
        )
        return PlanningSessionResponse.model_validate(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions/{session_id}", response_model=PlanningSessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Planungssitzung abrufen."""
    session = await service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Planungssitzung nicht gefunden")
    return PlanningSessionResponse.model_validate(session)


@router.patch("/sessions/{session_id}/input", response_model=PlanningSessionResponse)
async def update_input(
    session_id: str,
    data: PlanningSessionInputUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Input-Konfiguration der Planungssitzung aktualisieren."""
    try:
        session = await service.update_session_input(
            db=db,
            session_id=session_id,
            user_notes=data.user_notes,
            knowledge_doc_ids=data.knowledge_doc_ids,
            web_search_topics=data.web_search_topics,
            auto_context=data.auto_context,
        )
        return PlanningSessionResponse.model_validate(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/search", response_model=list[ExaSearchResult])
async def search_web(
    session_id: str,
    data: ExaSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exa.ai Web-Recherche starten."""
    try:
        results = await service.execute_web_search(
            db=db,
            session_id=session_id,
            topics=data.topics,
        )
        return [ExaSearchResult(**r) for r in results]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/generate", response_model=PlanningSessionResponse)
async def generate_plan(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Plan generieren — startet den WorkflowPlanningAgent.

    Die agent_instance_id in der Response kann fuer SSE-Streaming unter
    /api/stream/{instance_id} genutzt werden.
    """
    try:
        session = await service.generate_plan(
            db=db,
            session_id=session_id,
            session_factory=async_session,
        )
        return PlanningSessionResponse.model_validate(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/confirm", response_model=list[TaskResponse])
async def confirm_plan(
    session_id: str,
    data: ConfirmPlanRequest,
    db: AsyncSession = Depends(get_db),
):
    """Plan bestaetigen und Tasks erstellen.

    Erstellt alle Tasks in einer Transaktion. Nichts wird ohne
    explizite Bestaetigung geaendert.
    """
    try:
        tasks = await service.confirm_plan(
            db=db,
            session_id=session_id,
            request=data,
            session_factory=async_session,
        )
        return [TaskResponse.model_validate(t) for t in tasks]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/cancel", status_code=204)
async def cancel_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Planungssitzung abbrechen."""
    try:
        await service.cancel_session(db, session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
