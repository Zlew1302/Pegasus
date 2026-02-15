from datetime import UTC, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import AgentInstance, AgentType
from app.models.approval import Approval
from app.models.execution import ExecutionStep
from app.models.task import Task, TaskHistory
from app.models.project import Project
from app.schemas.dashboard import (
    ActivityEntry,
    AgentCostEntry,
    BudgetOverview,
    BudgetOverviewEntry,
    CostEntry,
    DashboardStats,
    ProductivityEntry,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    seven_days_ago = datetime.now(UTC) - timedelta(days=7)

    # Active agents (running or initializing, not deleted)
    active_result = await db.execute(
        select(func.count()).select_from(AgentInstance).where(
            AgentInstance.status.in_(["running", "initializing"]),
            AgentInstance.deleted_at.is_(None),
        )
    )
    active_agents = active_result.scalar() or 0

    # Pending approvals
    pending_result = await db.execute(
        select(func.count()).select_from(Approval).where(
            Approval.status == "pending"
        )
    )
    pending_inputs = pending_result.scalar() or 0

    # Weekly token cost
    cost_result = await db.execute(
        select(func.coalesce(func.sum(ExecutionStep.cost_cents), 0)).where(
            ExecutionStep.completed_at >= seven_days_ago
        )
    )
    weekly_token_cost_cents = cost_result.scalar() or 0

    # Tasks completed this week (status changed to 'done')
    tasks_done_result = await db.execute(
        select(func.count()).select_from(TaskHistory).where(
            and_(
                TaskHistory.field_name == "status",
                TaskHistory.new_value == "done",
                TaskHistory.changed_at >= seven_days_ago,
            )
        )
    )
    tasks_completed_this_week = tasks_done_result.scalar() or 0

    return DashboardStats(
        active_agents=active_agents,
        pending_inputs=pending_inputs,
        weekly_token_cost_cents=weekly_token_cost_cents,
        tasks_completed_this_week=tasks_completed_this_week,
    )


@router.get("/activity", response_model=list[ActivityEntry])
async def get_activity(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentInstance, AgentType.name, Task.title)
        .join(AgentType, AgentInstance.agent_type_id == AgentType.id)
        .join(Task, AgentInstance.task_id == Task.id)
        .where(AgentInstance.deleted_at.is_(None))
        .order_by(AgentInstance.started_at.desc().nullslast())
        .limit(limit)
    )
    rows = result.all()
    return [
        ActivityEntry(
            instance_id=inst.id,
            agent_name=agent_name,
            task_title=task_title,
            status=inst.status,
            started_at=inst.started_at,
            progress_percent=inst.progress_percent,
        )
        for inst, agent_name, task_title in rows
    ]


@router.get("/costs", response_model=list[CostEntry])
async def get_costs(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    project_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    # Default: last 30 days
    if not from_date:
        from_dt = datetime.now(UTC) - timedelta(days=30)
    else:
        from_dt = datetime.fromisoformat(from_date)
    if not to_date:
        to_dt = datetime.now(UTC)
    else:
        to_dt = datetime.fromisoformat(to_date)

    # Build query: execution_steps → agent_instances → tasks → projects
    query = (
        select(
            func.date(ExecutionStep.completed_at).label("day"),
            func.coalesce(func.sum(ExecutionStep.cost_cents), 0).label("cost"),
            Task.project_id,
            Project.title.label("project_title"),
        )
        .join(AgentInstance, ExecutionStep.agent_instance_id == AgentInstance.id)
        .join(Task, AgentInstance.task_id == Task.id)
        .join(Project, Task.project_id == Project.id)
        .where(
            and_(
                ExecutionStep.completed_at >= from_dt,
                ExecutionStep.completed_at <= to_dt,
            )
        )
        .group_by(func.date(ExecutionStep.completed_at), Task.project_id)
        .order_by(func.date(ExecutionStep.completed_at))
    )

    if project_id:
        query = query.where(Task.project_id == project_id)

    result = await db.execute(query)
    return [
        CostEntry(
            date=str(row.day),
            cost_cents=row.cost,
            project_id=row.project_id,
            project_title=row.project_title,
        )
        for row in result.all()
    ]


@router.get("/productivity", response_model=list[ProductivityEntry])
async def get_productivity(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
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

    result = await db.execute(
        select(
            func.date(TaskHistory.changed_at).label("day"),
            func.count().label("count"),
        )
        .where(
            and_(
                TaskHistory.field_name == "status",
                TaskHistory.new_value == "done",
                TaskHistory.changed_at >= from_dt,
                TaskHistory.changed_at <= to_dt,
            )
        )
        .group_by(func.date(TaskHistory.changed_at))
        .order_by(func.date(TaskHistory.changed_at))
    )
    return [
        ProductivityEntry(date=str(row.day), tasks_completed=row.count)
        for row in result.all()
    ]


@router.get("/budget-overview", response_model=BudgetOverview)
async def get_budget_overview(db: AsyncSession = Depends(get_db)):
    """Budget overview across all projects with real spent data."""
    # Subquery: sum of cost_cents per project via ExecutionStep → AgentInstance → Task
    spent_sq = (
        select(
            Task.project_id,
            func.coalesce(func.sum(ExecutionStep.cost_cents), 0).label("spent"),
        )
        .join(AgentInstance, AgentInstance.task_id == Task.id)
        .join(ExecutionStep, ExecutionStep.agent_instance_id == AgentInstance.id)
        .group_by(Task.project_id)
        .subquery()
    )

    result = await db.execute(
        select(
            Project.id,
            Project.title,
            Project.budget_cents,
            func.coalesce(spent_sq.c.spent, 0).label("spent_cents"),
        )
        .outerjoin(spent_sq, Project.id == spent_sq.c.project_id)
        .where(Project.deleted_at.is_(None))
        .order_by(Project.title)
    )

    entries = []
    total_budget = 0
    total_spent = 0
    for row in result.all():
        entry = BudgetOverviewEntry(
            project_id=row.id,
            project_title=row.title,
            budget_cents=row.budget_cents,
            spent_cents=row.spent_cents,
        )
        entries.append(entry)
        total_budget += row.budget_cents
        total_spent += row.spent_cents

    return BudgetOverview(
        projects=entries,
        total_budget_cents=total_budget,
        total_spent_cents=total_spent,
    )


@router.get("/agent-costs", response_model=list[AgentCostEntry])
async def get_agent_costs(
    project_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Cost breakdown by agent type, optionally filtered by project."""
    query = (
        select(
            AgentType.name.label("agent_type_name"),
            func.coalesce(func.sum(ExecutionStep.cost_cents), 0).label("total_cost_cents"),
            func.coalesce(func.sum(ExecutionStep.tokens_in), 0).label("total_tokens_in"),
            func.coalesce(func.sum(ExecutionStep.tokens_out), 0).label("total_tokens_out"),
            func.count(func.distinct(AgentInstance.id)).label("instance_count"),
        )
        .join(AgentInstance, AgentInstance.agent_type_id == AgentType.id)
        .join(ExecutionStep, ExecutionStep.agent_instance_id == AgentInstance.id)
    )

    if project_id:
        query = query.join(Task, AgentInstance.task_id == Task.id).where(
            Task.project_id == project_id
        )

    query = query.group_by(AgentType.id, AgentType.name).order_by(
        func.sum(ExecutionStep.cost_cents).desc()
    )

    result = await db.execute(query)
    return [
        AgentCostEntry(
            agent_type_name=row.agent_type_name,
            total_cost_cents=row.total_cost_cents,
            total_tokens_in=row.total_tokens_in,
            total_tokens_out=row.total_tokens_out,
            instance_count=row.instance_count,
        )
        for row in result.all()
    ]
