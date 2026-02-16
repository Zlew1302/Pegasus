"""Tests for Orchestrator endpoints."""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import AgentType
from app.models.project import Project


# ── Fixtures ──────────────────────────────────────────────────

@pytest_asyncio.fixture
async def project(db_session: AsyncSession) -> Project:
    """Create a test project."""
    p = Project(
        id="test-project-orch-001",
        title="Orchestrator Test-Projekt",
        description="Projekt zum Testen des Orchestrators",
        goal="Orchestrator testen",
        status="active",
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def orchestrator_agent_type(db_session: AsyncSession) -> AgentType:
    """Create the orchestrator agent type."""
    at = AgentType(
        id="agent-orchestrator-001",
        name="Orchestrator Agent",
        avatar="bot",
        description="Analysiert Aufgaben und delegiert sie an Sub-Agenten",
        capabilities='["task_analysis", "agent_delegation"]',
        tools='["read_project_context", "delegate_to_agent", "manage_task"]',
        system_prompt="Du bist der KI-Orchestrator.",
        model="claude-sonnet-4-20250514",
        temperature=0.3,
        max_tokens=8192,
        max_concurrent_instances=3,
        trust_level="propose",
        is_custom=False,
    )
    db_session.add(at)
    await db_session.commit()
    return at


# ── Start Endpoint Tests ─────────────────────────────────────

@pytest.mark.asyncio
async def test_start_orchestrator_missing_project(client: AsyncClient, orchestrator_agent_type: AgentType):
    """400 wenn Projekt nicht existiert."""
    resp = await client.post("/api/orchestrator/start", json={
        "project_id": "nonexistent-project",
        "instruction": "Teste den Orchestrator",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_orchestrator_empty_instruction(client: AsyncClient, project: Project):
    """400 bei leerer Anweisung."""
    resp = await client.post("/api/orchestrator/start", json={
        "project_id": project.id,
        "instruction": "   ",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_orchestrator_no_agent_type(client: AsyncClient, project: Project):
    """400 wenn Orchestrator-Agent-Typ nicht existiert."""
    resp = await client.post("/api/orchestrator/start", json={
        "project_id": project.id,
        "instruction": "Teste den Orchestrator",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_orchestrator_success(
    client: AsyncClient,
    project: Project,
    orchestrator_agent_type: AgentType,
):
    """Erfolgreicher Start gibt instance_id und task_id zurück."""
    resp = await client.post("/api/orchestrator/start", json={
        "project_id": project.id,
        "instruction": "Recherchiere die Top 5 Konkurrenten",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "instance_id" in data
    assert "task_id" in data
    assert len(data["instance_id"]) == 36  # UUID
    assert len(data["task_id"]) == 36


@pytest.mark.asyncio
async def test_start_orchestrator_creates_task(
    client: AsyncClient,
    project: Project,
    orchestrator_agent_type: AgentType,
):
    """Orchestrator erstellt einen Task mit dem korrekten Titel."""
    resp = await client.post("/api/orchestrator/start", json={
        "project_id": project.id,
        "instruction": "Erstelle eine Marktanalyse",
    })
    assert resp.status_code == 200
    data = resp.json()

    # Task prüfen
    task_resp = await client.get(f"/api/tasks/{data['task_id']}")
    assert task_resp.status_code == 200
    task_data = task_resp.json()
    assert task_data["title"].startswith("Orchestrator:")
    assert task_data["status"] == "in_progress"
    assert task_data["project_id"] == project.id


@pytest.mark.asyncio
async def test_start_orchestrator_creates_instance(
    client: AsyncClient,
    project: Project,
    orchestrator_agent_type: AgentType,
):
    """Orchestrator erstellt eine AgentInstance."""
    resp = await client.post("/api/orchestrator/start", json={
        "project_id": project.id,
        "instruction": "Erstelle einen Projektplan",
    })
    assert resp.status_code == 200
    data = resp.json()

    # Instance prüfen
    instance_resp = await client.get(f"/api/agents/instances/{data['instance_id']}")
    assert instance_resp.status_code == 200
    instance_data = instance_resp.json()
    assert instance_data["agent_type_id"] == "agent-orchestrator-001"
