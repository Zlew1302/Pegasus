import pytest
from datetime import UTC, datetime, timedelta
from httpx import AsyncClient

from app.models.agent import AgentInstance, AgentType
from app.models.approval import Approval
from app.models.execution import ExecutionStep
from app.models.project import Project
from app.models.task import Task, TaskHistory


async def _seed_dashboard_data(db_session):
    """Seed data for dashboard tests: project, tasks, agent, instances, steps, approvals."""
    project = Project(id="dash-proj-001", title="Dashboard Projekt", status="active")
    db_session.add(project)

    task1 = Task(id="dash-task-001", project_id="dash-proj-001", title="Task A", status="done")
    task2 = Task(id="dash-task-002", project_id="dash-proj-001", title="Task B", status="in_progress")
    db_session.add_all([task1, task2])

    agent_type = AgentType(
        id="dash-agent-type-001",
        name="Dashboard Test Agent",
        model="claude-sonnet-4-20250514",
        trust_level="medium",
    )
    db_session.add(agent_type)

    now = datetime.now(UTC)

    # Running agent instance
    instance1 = AgentInstance(
        id="dash-inst-001",
        agent_type_id="dash-agent-type-001",
        task_id="dash-task-002",
        status="running",
        started_at=now - timedelta(minutes=10),
        progress_percent=60,
    )
    # Completed agent instance
    instance2 = AgentInstance(
        id="dash-inst-002",
        agent_type_id="dash-agent-type-001",
        task_id="dash-task-001",
        status="completed",
        started_at=now - timedelta(hours=2),
        completed_at=now - timedelta(hours=1),
    )
    db_session.add_all([instance1, instance2])

    # Execution steps with costs
    step1 = ExecutionStep(
        id="dash-step-001",
        agent_instance_id="dash-inst-002",
        step_number=1,
        step_type="llm_call",
        description="Recherche",
        tokens_in=1000,
        tokens_out=500,
        cost_cents=5,
        completed_at=now - timedelta(hours=1),
    )
    step2 = ExecutionStep(
        id="dash-step-002",
        agent_instance_id="dash-inst-002",
        step_number=2,
        step_type="llm_call",
        description="Analyse",
        tokens_in=2000,
        tokens_out=1000,
        cost_cents=10,
        completed_at=now - timedelta(minutes=30),
    )
    db_session.add_all([step1, step2])

    # Task history: task completed
    history1 = TaskHistory(
        id="dash-hist-001",
        task_id="dash-task-001",
        changed_by_type="agent",
        field_name="status",
        old_value="review",
        new_value="done",
        changed_at=now - timedelta(hours=1),
    )
    db_session.add(history1)

    # Pending approval
    approval = Approval(
        id="dash-appr-001",
        task_id="dash-task-002",
        type="output_review",
        status="pending",
        description="Bitte pruefen",
    )
    db_session.add(approval)

    await db_session.commit()


@pytest.mark.asyncio
async def test_dashboard_stats(client: AsyncClient, db_session):
    await _seed_dashboard_data(db_session)
    resp = await client.get("/api/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_agents"] >= 1
    assert data["pending_inputs"] >= 1
    assert data["weekly_token_cost_cents"] >= 15
    assert data["tasks_completed_this_week"] >= 1


@pytest.mark.asyncio
async def test_dashboard_stats_empty(client: AsyncClient, db_session):
    resp = await client.get("/api/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_agents"] == 0
    assert data["pending_inputs"] == 0


@pytest.mark.asyncio
async def test_dashboard_activity(client: AsyncClient, db_session):
    await _seed_dashboard_data(db_session)
    resp = await client.get("/api/dashboard/activity?limit=10")
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) >= 1
    assert entries[0]["agent_name"] == "Dashboard Test Agent"


@pytest.mark.asyncio
async def test_dashboard_activity_empty(client: AsyncClient, db_session):
    resp = await client.get("/api/dashboard/activity")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_dashboard_costs(client: AsyncClient, db_session):
    await _seed_dashboard_data(db_session)
    resp = await client.get("/api/dashboard/costs")
    assert resp.status_code == 200
    costs = resp.json()
    assert len(costs) >= 1
    total = sum(c["cost_cents"] for c in costs)
    assert total >= 15


@pytest.mark.asyncio
async def test_dashboard_costs_with_project_filter(client: AsyncClient, db_session):
    await _seed_dashboard_data(db_session)
    resp = await client.get("/api/dashboard/costs?project_id=dash-proj-001")
    assert resp.status_code == 200
    costs = resp.json()
    assert all(c["project_id"] == "dash-proj-001" for c in costs)


@pytest.mark.asyncio
async def test_dashboard_productivity(client: AsyncClient, db_session):
    await _seed_dashboard_data(db_session)
    resp = await client.get("/api/dashboard/productivity")
    assert resp.status_code == 200
    prod = resp.json()
    assert len(prod) >= 1
    assert prod[0]["tasks_completed"] >= 1


@pytest.mark.asyncio
async def test_dashboard_productivity_empty(client: AsyncClient, db_session):
    resp = await client.get("/api/dashboard/productivity")
    assert resp.status_code == 200
    assert resp.json() == []
