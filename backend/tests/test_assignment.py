import pytest
from httpx import AsyncClient

from app.models.agent import AgentType
from app.models.project import Project
from app.models.task import Task


async def _seed_agent_types(db_session):
    """Seed research and planning agent types."""
    research = AgentType(
        id="agent-research-001",
        name="Research Agent",
        description="Recherchiert Themen",
        capabilities='["web_research", "summarization", "analysis", "comparison"]',
        tools='["web_search"]',
        model="claude-sonnet-4-20250514",
        max_concurrent_instances=5,
        trust_level="propose",
    )
    planning = AgentType(
        id="agent-planning-001",
        name="Planning Agent",
        description="Zerlegt Aufgaben",
        capabilities='["task_decomposition", "planning", "estimation", "dependency_analysis"]',
        tools='["read_project_context", "manage_task"]',
        model="claude-sonnet-4-20250514",
        max_concurrent_instances=5,
        trust_level="propose",
    )
    db_session.add(research)
    db_session.add(planning)
    await db_session.commit()


async def _create_task(client, title, tags=None, task_type=None, description=None):
    """Create a project and task."""
    proj_resp = await client.post("/api/projects", json={"title": "Test Projekt"})
    pid = proj_resp.json()["id"]
    body = {"title": title}
    if tags:
        body["tags"] = tags
    if task_type:
        body["task_type"] = task_type
    if description:
        body["description"] = description
    task_resp = await client.post(f"/api/projects/{pid}/tasks", json=body)
    return task_resp.json()


@pytest.mark.asyncio
async def test_suggest_research_task(client: AsyncClient, db_session):
    await _seed_agent_types(db_session)
    task = await _create_task(
        client,
        "Marktrecherche durchfuehren",
        tags='["RESEARCH"]',
        description="Recherche zu Wettbewerbern",
    )
    resp = await client.get(f"/api/agents/suggest/{task['id']}")
    assert resp.status_code == 200
    suggestions = resp.json()
    assert len(suggestions) >= 1
    # Research agent should be first with high confidence
    assert suggestions[0]["agent_type_id"] == "agent-research-001"
    assert suggestions[0]["confidence"] >= 40


@pytest.mark.asyncio
async def test_suggest_planning_task(client: AsyncClient, db_session):
    await _seed_agent_types(db_session)
    task = await _create_task(
        client,
        "Projektplanung erstellen",
        tags='["PLANNING"]',
        description="Aufgaben in Teilaufgaben zerlegen",
    )
    resp = await client.get(f"/api/agents/suggest/{task['id']}")
    assert resp.status_code == 200
    suggestions = resp.json()
    assert len(suggestions) >= 1
    assert suggestions[0]["agent_type_id"] == "agent-planning-001"
    assert suggestions[0]["confidence"] >= 40


@pytest.mark.asyncio
async def test_suggest_generic_task(client: AsyncClient, db_session):
    await _seed_agent_types(db_session)
    task = await _create_task(client, "Allgemeine Aufgabe")
    resp = await client.get(f"/api/agents/suggest/{task['id']}")
    assert resp.status_code == 200
    suggestions = resp.json()
    # Generic tasks may have no suggestions or low confidence
    for s in suggestions:
        assert s["confidence"] < 70


@pytest.mark.asyncio
async def test_suggest_task_not_found(client: AsyncClient, db_session):
    await _seed_agent_types(db_session)
    resp = await client.get("/api/agents/suggest/nonexistent")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_suggest_keyword_match(client: AsyncClient, db_session):
    await _seed_agent_types(db_session)
    task = await _create_task(
        client,
        "Analyse und Vergleich",
        description="Wir brauchen eine gruendliche Analyse und einen Vergleich",
    )
    resp = await client.get(f"/api/agents/suggest/{task['id']}")
    assert resp.status_code == 200
    suggestions = resp.json()
    # Should match Research Agent via keyword "analyse" + "vergleich"
    research_suggestions = [s for s in suggestions if s["agent_type_id"] == "agent-research-001"]
    assert len(research_suggestions) >= 1
