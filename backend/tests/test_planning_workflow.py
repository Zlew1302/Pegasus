"""Tests for the KI planning workflow endpoints."""

import json

import pytest
from httpx import AsyncClient


# ── Helper ───────────────────────────────────────────────────

async def _create_project(client: AsyncClient) -> str:
    resp = await client.post(
        "/api/projects",
        json={
            "title": "Testprojekt",
            "description": "Ein Projekt zum Testen",
            "goal": "Testen der KI-Planung",
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# ── Session CRUD ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_session(client: AsyncClient):
    project_id = await _create_project(client)
    resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "project_overview"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["project_id"] == project_id
    assert data["status"] == "input"
    assert data["input_mode"] == "project_overview"
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_create_session_custom_input(client: AsyncClient):
    project_id = await _create_project(client)
    resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    assert resp.status_code == 201
    assert resp.json()["input_mode"] == "custom_input"


@pytest.mark.asyncio
async def test_create_session_invalid_project(client: AsyncClient):
    resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": "nonexistent-id", "input_mode": "project_overview"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_session(client: AsyncClient):
    project_id = await _create_project(client)
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    session_id = create_resp.json()["id"]

    resp = await client.get(f"/api/planning/sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == session_id


@pytest.mark.asyncio
async def test_get_session_not_found(client: AsyncClient):
    resp = await client.get("/api/planning/sessions/nonexistent-id")
    assert resp.status_code == 404


# ── Input Update ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_input(client: AsyncClient):
    project_id = await _create_project(client)
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    session_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/planning/sessions/{session_id}/input",
        json={
            "user_notes": "Meine Wünsche und Anmerkungen",
            "knowledge_doc_ids": ["doc-1", "doc-2"],
            "web_search_topics": ["KI-Planung", "Projektmanagement"],
            "auto_context": False,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_notes"] == "Meine Wünsche und Anmerkungen"
    assert json.loads(data["knowledge_doc_ids"]) == ["doc-1", "doc-2"]
    assert json.loads(data["web_search_topics"]) == ["KI-Planung", "Projektmanagement"]
    assert data["auto_context"] is False


@pytest.mark.asyncio
async def test_update_input_with_auto_context(client: AsyncClient):
    project_id = await _create_project(client)
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    session_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/planning/sessions/{session_id}/input",
        json={"auto_context": True},
    )
    assert resp.status_code == 200
    assert resp.json()["auto_context"] is True


@pytest.mark.asyncio
async def test_update_input_nonexistent_session(client: AsyncClient):
    resp = await client.patch(
        "/api/planning/sessions/nonexistent-id/input",
        json={"user_notes": "Test"},
    )
    assert resp.status_code == 400


# ── Search ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_no_api_key(client: AsyncClient):
    """Search should fail gracefully when no Exa API key is configured."""
    project_id = await _create_project(client)
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    session_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/planning/sessions/{session_id}/search",
        json={"topics": ["Test Thema"]},
    )
    # Should return 400 because no API key configured
    assert resp.status_code == 400
    assert "API-Key" in resp.json()["detail"]


# ── Cancel ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cancel_session(client: AsyncClient):
    project_id = await _create_project(client)
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    session_id = create_resp.json()["id"]

    resp = await client.post(f"/api/planning/sessions/{session_id}/cancel")
    assert resp.status_code == 204

    # Verify cancelled
    get_resp = await client.get(f"/api/planning/sessions/{session_id}")
    assert get_resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_nonexistent_session(client: AsyncClient):
    resp = await client.post("/api/planning/sessions/nonexistent-id/cancel")
    assert resp.status_code == 400


# ── Confirm (Direct) ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_confirm_requires_review_status(client: AsyncClient):
    """Confirm should fail if session is not in review status."""
    project_id = await _create_project(client)
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    session_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/planning/sessions/{session_id}/confirm",
        json={
            "tasks": [
                {
                    "title": "Task 1",
                    "priority": "medium",
                    "order": 1,
                }
            ],
            "auto_start_agents": False,
        },
    )
    assert resp.status_code == 400
    assert "Review" in resp.json()["detail"]


# ── Confirm (With Manual Review Setup) ───────────────────────


@pytest.mark.asyncio
async def test_confirm_creates_tasks(client: AsyncClient, db_session):
    """Test confirming a plan creates tasks correctly."""
    project_id = await _create_project(client)
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    session_id = create_resp.json()["id"]

    # Manually set session to review status
    from app.models.planning_session import PlanningSession
    ps = await db_session.get(PlanningSession, session_id)
    ps.status = "review"
    ps.generated_plan = json.dumps({
        "tasks": [],
        "milestones": [],
        "summary": "Test",
        "timeline_notes": None,
    })
    await db_session.commit()

    # Confirm with tasks
    resp = await client.post(
        f"/api/planning/sessions/{session_id}/confirm",
        json={
            "tasks": [
                {
                    "title": "Recherche durchführen",
                    "description": "Relevante Quellen sammeln",
                    "priority": "high",
                    "agent_type_id": None,
                    "agent_type_name": None,
                    "estimated_duration_minutes": 60,
                    "tags": "RESEARCH",
                    "acceptance_criteria": "Mindestens 5 Quellen",
                    "milestone": "Phase 1",
                    "order": 1,
                },
                {
                    "title": "Bericht erstellen",
                    "description": "Ergebnisse zusammenfassen",
                    "priority": "medium",
                    "agent_type_id": None,
                    "agent_type_name": None,
                    "estimated_duration_minutes": 120,
                    "tags": "CONTENT",
                    "acceptance_criteria": None,
                    "milestone": "Phase 2",
                    "order": 2,
                },
            ],
            "auto_start_agents": False,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["title"] == "Recherche durchführen"
    assert data[0]["priority"] == "high"
    assert data[0]["status"] == "todo"
    assert data[0]["tags"] == "RESEARCH"
    assert data[1]["title"] == "Bericht erstellen"
    assert data[1]["priority"] == "medium"

    # Verify session is confirmed
    get_resp = await client.get(f"/api/planning/sessions/{session_id}")
    assert get_resp.json()["status"] == "confirmed"
    confirmed_plan = json.loads(get_resp.json()["confirmed_plan"])
    assert len(confirmed_plan) == 2

    # Verify tasks exist in project
    tasks_resp = await client.get(f"/api/projects/{project_id}/tasks")
    tasks = tasks_resp.json()
    # Filter out any planning tasks
    project_tasks = [t for t in tasks if not t["title"].startswith("KI-Planung:")]
    assert len(project_tasks) >= 2


@pytest.mark.asyncio
async def test_confirm_empty_tasks(client: AsyncClient, db_session):
    """Confirm with empty tasks should still work (creates nothing)."""
    project_id = await _create_project(client)
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    session_id = create_resp.json()["id"]

    # Set to review
    from app.models.planning_session import PlanningSession
    ps = await db_session.get(PlanningSession, session_id)
    ps.status = "review"
    ps.generated_plan = json.dumps({"tasks": [], "milestones": [], "summary": "", "timeline_notes": None})
    await db_session.commit()

    resp = await client.post(
        f"/api/planning/sessions/{session_id}/confirm",
        json={"tasks": [], "auto_start_agents": False},
    )
    assert resp.status_code == 200
    assert resp.json() == []


# ── Lifecycle Integration ────────────────────────────────────


@pytest.mark.asyncio
async def test_full_lifecycle_cancel(client: AsyncClient):
    """Test creating and cancelling a session."""
    project_id = await _create_project(client)

    # Create
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    assert create_resp.status_code == 201
    session_id = create_resp.json()["id"]

    # Update input
    update_resp = await client.patch(
        f"/api/planning/sessions/{session_id}/input",
        json={"user_notes": "Test Notiz"},
    )
    assert update_resp.status_code == 200

    # Cancel
    cancel_resp = await client.post(f"/api/planning/sessions/{session_id}/cancel")
    assert cancel_resp.status_code == 204

    # Verify state
    get_resp = await client.get(f"/api/planning/sessions/{session_id}")
    assert get_resp.json()["status"] == "cancelled"
    assert get_resp.json()["user_notes"] == "Test Notiz"


@pytest.mark.asyncio
async def test_cannot_cancel_confirmed_session(client: AsyncClient, db_session):
    """Confirmed sessions cannot be cancelled."""
    project_id = await _create_project(client)
    create_resp = await client.post(
        "/api/planning/sessions",
        json={"project_id": project_id, "input_mode": "custom_input"},
    )
    session_id = create_resp.json()["id"]

    # Manually set to confirmed
    from app.models.planning_session import PlanningSession
    ps = await db_session.get(PlanningSession, session_id)
    ps.status = "confirmed"
    await db_session.commit()

    resp = await client.post(f"/api/planning/sessions/{session_id}/cancel")
    assert resp.status_code == 400
