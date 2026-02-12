import pytest
from httpx import AsyncClient

from app.models.approval import Approval


async def _create_project_task_approval(client, db_session) -> tuple[str, str]:
    """Create project + task + approval, return (task_id, approval_id)."""
    proj_resp = await client.post("/api/projects", json={"title": "Approval Projekt"})
    pid = proj_resp.json()["id"]
    task_resp = await client.post(
        f"/api/projects/{pid}/tasks", json={"title": "Approval Task"}
    )
    task_id = task_resp.json()["id"]

    # Manually insert an approval
    approval = Approval(
        id="test-approval-001",
        task_id=task_id,
        type="output_review",
        status="pending",
        description="Bericht pruefen",
    )
    db_session.add(approval)
    await db_session.commit()
    return task_id, "test-approval-001"


@pytest.mark.asyncio
async def test_list_approvals(client: AsyncClient, db_session):
    _, approval_id = await _create_project_task_approval(client, db_session)
    resp = await client.get("/api/approvals")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_list_approvals_filter_pending(client: AsyncClient, db_session):
    _, approval_id = await _create_project_task_approval(client, db_session)
    resp = await client.get("/api/approvals?status=pending")
    assert resp.status_code == 200
    approvals = resp.json()
    assert all(a["status"] == "pending" for a in approvals)


@pytest.mark.asyncio
async def test_get_approval(client: AsyncClient, db_session):
    _, approval_id = await _create_project_task_approval(client, db_session)
    resp = await client.get(f"/api/approvals/{approval_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_get_approval_not_found(client: AsyncClient):
    resp = await client.get("/api/approvals/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_resolve_approval_approved(client: AsyncClient, db_session):
    task_id, approval_id = await _create_project_task_approval(client, db_session)
    resp = await client.post(
        f"/api/approvals/{approval_id}/resolve",
        json={"status": "approved", "comment": "Sieht gut aus"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"
    assert data["reviewer_comment"] == "Sieht gut aus"
    # Task should be done
    task_resp = await client.get(f"/api/tasks/{task_id}")
    assert task_resp.json()["status"] == "done"


@pytest.mark.asyncio
async def test_resolve_approval_rejected(client: AsyncClient, db_session):
    task_id, approval_id = await _create_project_task_approval(client, db_session)
    resp = await client.post(
        f"/api/approvals/{approval_id}/resolve",
        json={"status": "rejected"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    task_resp = await client.get(f"/api/tasks/{task_id}")
    assert task_resp.json()["status"] == "todo"


@pytest.mark.asyncio
async def test_resolve_approval_changes_requested(client: AsyncClient, db_session):
    task_id, approval_id = await _create_project_task_approval(client, db_session)
    resp = await client.post(
        f"/api/approvals/{approval_id}/resolve",
        json={"status": "changes_requested", "comment": "Mehr Details bitte"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "changes_requested"
    task_resp = await client.get(f"/api/tasks/{task_id}")
    assert task_resp.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_resolve_already_resolved(client: AsyncClient, db_session):
    _, approval_id = await _create_project_task_approval(client, db_session)
    await client.post(
        f"/api/approvals/{approval_id}/resolve", json={"status": "approved"}
    )
    resp = await client.post(
        f"/api/approvals/{approval_id}/resolve", json={"status": "rejected"}
    )
    assert resp.status_code == 422
