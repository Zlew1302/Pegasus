import pytest
from httpx import AsyncClient

from app.models.agent import AgentType
from app.models.project import Project
from app.models.task import Task


async def _seed_agent_type(client, db_session):
    """Seed an agent type directly in the DB for testing."""
    agent_type = AgentType(
        id="test-agent-001",
        name="Test Agent",
        description="Ein Test-Agent",
        model="claude-sonnet-4-20250514",
        system_prompt="Du bist ein Test-Agent.",
        max_concurrent_instances=2,
        trust_level="medium",
    )
    db_session.add(agent_type)
    await db_session.commit()
    return agent_type


async def _seed_project_and_task(client, db_session):
    """Create a project and task via API."""
    proj_resp = await client.post("/api/projects", json={"title": "Agent Test Projekt"})
    pid = proj_resp.json()["id"]
    task_resp = await client.post(
        f"/api/projects/{pid}/tasks", json={"title": "Agent Task"}
    )
    return task_resp.json()


@pytest.mark.asyncio
async def test_list_agent_types(client: AsyncClient, db_session):
    await _seed_agent_type(client, db_session)
    resp = await client.get("/api/agents/types")
    assert resp.status_code == 200
    types = resp.json()
    assert len(types) >= 1
    assert any(t["id"] == "test-agent-001" for t in types)


@pytest.mark.asyncio
async def test_get_agent_type(client: AsyncClient, db_session):
    await _seed_agent_type(client, db_session)
    resp = await client.get("/api/agents/types/test-agent-001")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test Agent"


@pytest.mark.asyncio
async def test_get_agent_type_not_found(client: AsyncClient):
    resp = await client.get("/api/agents/types/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_spawn_agent(client: AsyncClient, db_session):
    await _seed_agent_type(client, db_session)
    task = await _seed_project_and_task(client, db_session)
    resp = await client.post(
        "/api/agents/spawn",
        json={"agent_type_id": "test-agent-001", "task_id": task["id"]},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "initializing"
    assert data["agent_type_id"] == "test-agent-001"
    assert data["task_id"] == task["id"]


@pytest.mark.asyncio
async def test_spawn_agent_type_not_found(client: AsyncClient, db_session):
    task = await _seed_project_and_task(client, db_session)
    resp = await client.post(
        "/api/agents/spawn",
        json={"agent_type_id": "nonexistent", "task_id": task["id"]},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_spawn_agent_task_not_found(client: AsyncClient, db_session):
    await _seed_agent_type(client, db_session)
    resp = await client.post(
        "/api/agents/spawn",
        json={"agent_type_id": "test-agent-001", "task_id": "nonexistent"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_agent_instance(client: AsyncClient, db_session):
    await _seed_agent_type(client, db_session)
    task = await _seed_project_and_task(client, db_session)
    spawn_resp = await client.post(
        "/api/agents/spawn",
        json={"agent_type_id": "test-agent-001", "task_id": task["id"]},
    )
    instance_id = spawn_resp.json()["id"]
    resp = await client.get(f"/api/agents/instances/{instance_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == instance_id


@pytest.mark.asyncio
async def test_get_agent_instance_not_found(client: AsyncClient):
    resp = await client.get("/api/agents/instances/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cancel_agent(client: AsyncClient, db_session):
    await _seed_agent_type(client, db_session)
    task = await _seed_project_and_task(client, db_session)
    spawn_resp = await client.post(
        "/api/agents/spawn",
        json={"agent_type_id": "test-agent-001", "task_id": task["id"]},
    )
    instance_id = spawn_resp.json()["id"]
    resp = await client.post(f"/api/agents/instances/{instance_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
