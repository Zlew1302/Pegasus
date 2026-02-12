import pytest
from datetime import UTC, datetime, timedelta
from httpx import AsyncClient

from app.models.agent import AgentInstance, AgentType
from app.models.execution import ExecutionStep
from app.models.project import Project
from app.models.task import Task, TaskHistory


@pytest.mark.asyncio
async def test_get_profile_auto_create(client: AsyncClient):
    resp = await client.get("/api/profile")
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "Benutzer"
    assert "id" in data


@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient):
    # Ensure profile exists
    await client.get("/api/profile")
    resp = await client.patch(
        "/api/profile",
        json={"display_name": "Lukas", "global_system_prompt": "Sei hilfsbereit."},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "Lukas"
    assert data["global_system_prompt"] == "Sei hilfsbereit."


@pytest.mark.asyncio
async def test_api_keys_crud(client: AsyncClient):
    # Create
    resp = await client.post(
        "/api/profile/api-keys",
        json={
            "provider": "anthropic",
            "key_name": "Main Key",
            "key_encrypted": "sk-ant-1234567890abcdef",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["provider"] == "anthropic"
    assert data["key_name"] == "Main Key"
    assert "sk-a" in data["key_masked"]
    assert "cdef" in data["key_masked"]
    key_id = data["id"]

    # List
    list_resp = await client.get("/api/profile/api-keys")
    assert list_resp.status_code == 200
    keys = list_resp.json()
    assert len(keys) >= 1
    assert any(k["id"] == key_id for k in keys)

    # Toggle off
    toggle_resp = await client.patch(
        f"/api/profile/api-keys/{key_id}",
        json={"is_active": False},
    )
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["is_active"] is False

    # Delete
    del_resp = await client.delete(f"/api/profile/api-keys/{key_id}")
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_api_key_not_found(client: AsyncClient):
    resp = await client.delete("/api/profile/api-keys/nonexistent")
    assert resp.status_code == 404
    resp2 = await client.patch(
        "/api/profile/api-keys/nonexistent", json={"is_active": True}
    )
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_audit_trail(client: AsyncClient, db_session):
    # Seed data
    project = Project(id="audit-proj-001", title="Audit Projekt")
    db_session.add(project)
    task = Task(id="audit-task-001", project_id="audit-proj-001", title="Audit Task")
    db_session.add(task)
    now = datetime.now(UTC)
    history = TaskHistory(
        id="audit-hist-001",
        task_id="audit-task-001",
        changed_by_type="human",
        field_name="status",
        old_value="backlog",
        new_value="todo",
        changed_at=now,
    )
    db_session.add(history)
    await db_session.commit()

    resp = await client.get("/api/profile/audit-trail?limit=10")
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) >= 1
    assert entries[0]["target_type"] == "task"


@pytest.mark.asyncio
async def test_audit_trail_empty(client: AsyncClient):
    resp = await client.get("/api/profile/audit-trail")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_token_usage_by_agent(client: AsyncClient, db_session):
    now = datetime.now(UTC)
    project = Project(id="token-proj-001", title="Token Projekt")
    db_session.add(project)
    task = Task(id="token-task-001", project_id="token-proj-001", title="Token Task")
    db_session.add(task)
    agent_type = AgentType(
        id="token-at-001",
        name="Token Agent",
        model="claude-sonnet-4-20250514",
        trust_level="medium",
    )
    db_session.add(agent_type)
    instance = AgentInstance(
        id="token-inst-001",
        agent_type_id="token-at-001",
        task_id="token-task-001",
        status="completed",
        started_at=now - timedelta(hours=1),
    )
    db_session.add(instance)
    step = ExecutionStep(
        id="token-step-001",
        agent_instance_id="token-inst-001",
        step_number=1,
        step_type="llm_call",
        tokens_in=500,
        tokens_out=200,
        cost_cents=3,
        completed_at=now,
    )
    db_session.add(step)
    await db_session.commit()

    resp = await client.get("/api/profile/token-usage?group_by=agent")
    assert resp.status_code == 200
    usage = resp.json()
    assert len(usage) >= 1
    assert usage[0]["group_name"] == "Token Agent"
    assert usage[0]["total_tokens_in"] >= 500


@pytest.mark.asyncio
async def test_token_usage_by_project(client: AsyncClient, db_session):
    now = datetime.now(UTC)
    project = Project(id="tokproj-001", title="Projekt Token Test")
    db_session.add(project)
    task = Task(id="toktask-001", project_id="tokproj-001", title="TT")
    db_session.add(task)
    agent_type = AgentType(
        id="tokat-001", name="TA", model="claude-sonnet-4-20250514", trust_level="medium"
    )
    db_session.add(agent_type)
    instance = AgentInstance(
        id="tokinst-001",
        agent_type_id="tokat-001",
        task_id="toktask-001",
        status="completed",
        started_at=now - timedelta(hours=1),
    )
    db_session.add(instance)
    step = ExecutionStep(
        id="tokstep-001",
        agent_instance_id="tokinst-001",
        step_number=1,
        step_type="llm_call",
        tokens_in=300,
        tokens_out=100,
        cost_cents=2,
        completed_at=now,
    )
    db_session.add(step)
    await db_session.commit()

    resp = await client.get("/api/profile/token-usage?group_by=project")
    assert resp.status_code == 200
    usage = resp.json()
    assert len(usage) >= 1
    assert usage[0]["group_name"] == "Projekt Token Test"
