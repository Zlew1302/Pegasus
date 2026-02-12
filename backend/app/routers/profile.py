from datetime import UTC, datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import AgentInstance, AgentType
from app.models.budget import ApiKey
from app.models.execution import ExecutionStep
from app.models.task import Task, TaskHistory
from app.models.project import Project
from app.models.user import UserProfile
from app.schemas.user import (
    ApiKeyCreate,
    ApiKeyResponse,
    ApiKeyToggle,
    AuditEntry,
    TokenUsageEntry,
    UserProfileResponse,
    UserProfileUpdate,
)

router = APIRouter(prefix="/api/profile", tags=["profile"])

DEFAULT_PROFILE_ID = "default-user"


async def _get_or_create_profile(db: AsyncSession) -> UserProfile:
    """Get user profile, auto-create if not exists."""
    result = await db.execute(
        select(UserProfile).where(UserProfile.id == DEFAULT_PROFILE_ID)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(
            id=DEFAULT_PROFILE_ID,
            display_name="Benutzer",
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


@router.get("", response_model=UserProfileResponse)
async def get_profile(db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_profile(db)
    return UserProfileResponse.model_validate(profile)


@router.patch("", response_model=UserProfileResponse)
async def update_profile(
    data: UserProfileUpdate, db: AsyncSession = Depends(get_db)
):
    profile = await _get_or_create_profile(db)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return UserProfileResponse.model_validate(profile)


# --- API Keys ---


def _mask_key(key: str) -> str:
    """Mask an API key: show first 4 and last 4 chars."""
    if len(key) <= 8:
        return "****"
    return key[:4] + "..." + key[-4:]


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ApiKey).order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        ApiKeyResponse(
            id=k.id,
            provider=k.provider,
            key_name=k.key_name,
            key_masked=_mask_key(k.key_encrypted),
            is_active=k.is_active,
            created_at=k.created_at,
        )
        for k in keys
    ]


@router.post("/api-keys", response_model=ApiKeyResponse, status_code=201)
async def create_api_key(data: ApiKeyCreate, db: AsyncSession = Depends(get_db)):
    key = ApiKey(id=str(uuid4()), **data.model_dump())
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return ApiKeyResponse(
        id=key.id,
        provider=key.provider,
        key_name=key.key_name,
        key_masked=_mask_key(key.key_encrypted),
        is_active=key.is_active,
        created_at=key.created_at,
    )


@router.delete("/api-keys/{key_id}", status_code=204)
async def delete_api_key(key_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API-Key nicht gefunden")
    await db.delete(key)
    await db.commit()


@router.patch("/api-keys/{key_id}", response_model=ApiKeyResponse)
async def toggle_api_key(
    key_id: str, data: ApiKeyToggle, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API-Key nicht gefunden")
    key.is_active = data.is_active
    await db.commit()
    await db.refresh(key)
    return ApiKeyResponse(
        id=key.id,
        provider=key.provider,
        key_name=key.key_name,
        key_masked=_mask_key(key.key_encrypted),
        is_active=key.is_active,
        created_at=key.created_at,
    )


# --- Audit Trail ---


@router.get("/audit-trail", response_model=list[AuditEntry])
async def get_audit_trail(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Build audit trail from task_history + execution_steps."""
    # Task history entries
    history_result = await db.execute(
        select(TaskHistory, Task.title)
        .join(Task, TaskHistory.task_id == Task.id)
        .order_by(TaskHistory.changed_at.desc())
        .offset(offset)
        .limit(limit)
    )
    entries = []
    for hist, task_title in history_result.all():
        entries.append(
            AuditEntry(
                timestamp=hist.changed_at,
                actor_type=hist.changed_by_type or "system",
                actor_id=hist.changed_by_id,
                action=f"{hist.field_name}: {hist.old_value} → {hist.new_value}",
                target_type="task",
                target_title=task_title,
            )
        )

    # Execution steps
    exec_result = await db.execute(
        select(ExecutionStep, AgentType.name, Task.title)
        .join(AgentInstance, ExecutionStep.agent_instance_id == AgentInstance.id)
        .join(AgentType, AgentInstance.agent_type_id == AgentType.id)
        .join(Task, AgentInstance.task_id == Task.id)
        .order_by(ExecutionStep.completed_at.desc().nullslast())
        .offset(offset)
        .limit(limit)
    )
    for step, agent_name, task_title in exec_result.all():
        entries.append(
            AuditEntry(
                timestamp=step.completed_at or step.started_at or datetime.now(UTC),
                actor_type="agent",
                actor_id=step.agent_instance_id,
                action=f"{step.step_type}: {step.description or 'Schritt ' + str(step.step_number)}",
                target_type="task",
                target_title=task_title,
                details=step.output_summary,
                tokens=(step.tokens_in or 0) + (step.tokens_out or 0),
                cost_cents=step.cost_cents,
            )
        )

    # Sort combined by timestamp descending
    entries.sort(key=lambda e: e.timestamp, reverse=True)
    return entries[:limit]


# --- Token Usage ---


@router.get("/token-usage", response_model=list[TokenUsageEntry])
async def get_token_usage(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    group_by: str = Query("agent", pattern="^(agent|project)$"),
    db: AsyncSession = Depends(get_db),
):
    if not from_date:
        from_dt = datetime.now(UTC) - timedelta(days=30)
    else:
        from_dt = datetime.fromisoformat(from_date)
    if not to_date:
        to_dt = datetime.now(UTC)
    else:
        to_dt = datetime.fromisoformat(to_date)

    date_filter = and_(
        ExecutionStep.completed_at >= from_dt,
        ExecutionStep.completed_at <= to_dt,
    )

    if group_by == "agent":
        result = await db.execute(
            select(
                AgentType.id,
                AgentType.name,
                func.coalesce(func.sum(ExecutionStep.tokens_in), 0).label("tokens_in"),
                func.coalesce(func.sum(ExecutionStep.tokens_out), 0).label("tokens_out"),
                func.coalesce(func.sum(ExecutionStep.cost_cents), 0).label("cost"),
            )
            .join(AgentInstance, ExecutionStep.agent_instance_id == AgentInstance.id)
            .join(AgentType, AgentInstance.agent_type_id == AgentType.id)
            .where(date_filter)
            .group_by(AgentType.id)
        )
    else:  # project
        result = await db.execute(
            select(
                Project.id,
                Project.title,
                func.coalesce(func.sum(ExecutionStep.tokens_in), 0).label("tokens_in"),
                func.coalesce(func.sum(ExecutionStep.tokens_out), 0).label("tokens_out"),
                func.coalesce(func.sum(ExecutionStep.cost_cents), 0).label("cost"),
            )
            .join(AgentInstance, ExecutionStep.agent_instance_id == AgentInstance.id)
            .join(Task, AgentInstance.task_id == Task.id)
            .join(Project, Task.project_id == Project.id)
            .where(date_filter)
            .group_by(Project.id)
        )

    return [
        TokenUsageEntry(
            group_id=row.id,
            group_name=row.name if group_by == "agent" else row.title,
            total_tokens_in=row.tokens_in,
            total_tokens_out=row.tokens_out,
            total_cost_cents=row.cost,
        )
        for row in result.all()
    ]
