import pytest
from datetime import datetime, UTC
from httpx import AsyncClient

from app.models.agent import AgentInstance, AgentType
from app.models.execution import ExecutionStep
from app.models.project import Project
from app.models.task import Task


async def _seed_instance_with_steps(db_session):
    """Create agent type, project, task, instance, and execution steps."""
    agent_type = AgentType(
        id="test-steps-agent",
        name="Steps Test Agent",
        model="claude-sonnet-4-20250514",
        max_concurrent_instances=5,
        trust_level="propose",
    )
    db_session.add(agent_type)

    project = Project(id="test-steps-project", title="Steps Test Projekt")
    db_session.add(project)

    task = Task(
        id="test-steps-task",
        project_id="test-steps-project",
        title="Steps Task",
        status="in_progress",
        priority="medium",
        sort_order=0,
    )
    db_session.add(task)

    instance = AgentInstance(
        id="test-steps-instance",
        agent_type_id="test-steps-agent",
        task_id="test-steps-task",
        status="completed",
        started_at=datetime.now(UTC),
        completed_at=datetime.now(UTC),
        total_cost_cents=25,
    )
    db_session.add(instance)

    # Add steps
    for i in range(1, 4):
        step = ExecutionStep(
            id=f"test-step-{i:03d}",
            agent_instance_id="test-steps-instance",
            step_number=i,
            step_type="llm_call" if i != 2 else "tool_call",
            description=f"Step {i} description",
            model="claude-sonnet-4-20250514" if i != 2 else "",
            tokens_in=500 * i,
            tokens_out=200 * i,
            cost_cents=5 * i,
            duration_ms=1000 * i,
            started_at=datetime.now(UTC),
        )
        db_session.add(step)

    # Child instance
    child = AgentInstance(
        id="test-child-instance",
        agent_type_id="test-steps-agent",
        task_id="test-steps-task",
        status="completed",
        parent_instance_id="test-steps-instance",
        started_at=datetime.now(UTC),
        completed_at=datetime.now(UTC),
    )
    db_session.add(child)

    await db_session.commit()


@pytest.mark.asyncio
async def test_list_execution_steps(client: AsyncClient, db_session):
    await _seed_instance_with_steps(db_session)
    resp = await client.get("/api/agents/instances/test-steps-instance/steps")
    assert resp.status_code == 200
    steps = resp.json()
    assert len(steps) == 3
    assert steps[0]["step_number"] == 1
    assert steps[0]["step_type"] == "llm_call"
    assert steps[1]["step_type"] == "tool_call"
    assert steps[2]["step_number"] == 3


@pytest.mark.asyncio
async def test_steps_cost_totals(client: AsyncClient, db_session):
    await _seed_instance_with_steps(db_session)
    resp = await client.get("/api/agents/instances/test-steps-instance/steps")
    steps = resp.json()
    total_cost = sum(s["cost_cents"] for s in steps)
    assert total_cost == 30  # 5 + 10 + 15


@pytest.mark.asyncio
async def test_steps_empty_for_unknown_instance(client: AsyncClient, db_session):
    await _seed_instance_with_steps(db_session)
    resp = await client.get("/api/agents/instances/nonexistent/steps")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_child_instances(client: AsyncClient, db_session):
    await _seed_instance_with_steps(db_session)
    resp = await client.get("/api/agents/instances/test-steps-instance/children")
    assert resp.status_code == 200
    children = resp.json()
    assert len(children) == 1
    assert children[0]["id"] == "test-child-instance"
    assert children[0]["parent_instance_id"] == "test-steps-instance"


@pytest.mark.asyncio
async def test_children_empty_for_leaf_instance(client: AsyncClient, db_session):
    await _seed_instance_with_steps(db_session)
    resp = await client.get("/api/agents/instances/test-child-instance/children")
    assert resp.status_code == 200
    assert resp.json() == []
