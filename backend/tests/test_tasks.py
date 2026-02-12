import pytest
from httpx import AsyncClient


async def _create_project(client: AsyncClient) -> str:
    resp = await client.post("/api/projects", json={"title": "Testprojekt"})
    return resp.json()["id"]


async def _create_task(client: AsyncClient, project_id: str, **kwargs) -> dict:
    data = {"title": "Test Task", **kwargs}
    resp = await client.post(f"/api/projects/{project_id}/tasks", json=data)
    return resp.json()


@pytest.mark.asyncio
async def test_create_task(client: AsyncClient):
    pid = await _create_project(client)
    resp = await client.post(
        f"/api/projects/{pid}/tasks",
        json={"title": "Meine Aufgabe", "priority": "high"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Meine Aufgabe"
    assert data["priority"] == "high"
    assert data["status"] == "backlog"


@pytest.mark.asyncio
async def test_create_task_project_not_found(client: AsyncClient):
    resp = await client.post("/api/projects/nonexistent/tasks", json={"title": "T"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_tasks(client: AsyncClient):
    pid = await _create_project(client)
    await _create_task(client, pid, title="A")
    await _create_task(client, pid, title="B")
    resp = await client.get(f"/api/projects/{pid}/tasks")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_list_tasks_filter_by_status(client: AsyncClient):
    pid = await _create_project(client)
    task = await _create_task(client, pid, title="Filtered")
    # Move to todo
    await client.patch(f"/api/tasks/{task['id']}/status", json={"status": "todo"})
    resp = await client.get(f"/api/projects/{pid}/tasks?status=todo")
    assert len(resp.json()) == 1
    resp2 = await client.get(f"/api/projects/{pid}/tasks?status=done")
    assert len(resp2.json()) == 0


@pytest.mark.asyncio
async def test_get_task(client: AsyncClient):
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    resp = await client.get(f"/api/tasks/{task['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == task["id"]


@pytest.mark.asyncio
async def test_get_task_not_found(client: AsyncClient):
    resp = await client.get("/api/tasks/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_task(client: AsyncClient):
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    resp = await client.patch(
        f"/api/tasks/{task['id']}", json={"title": "Geaendert"}
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Geaendert"


@pytest.mark.asyncio
async def test_delete_task(client: AsyncClient):
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    resp = await client.delete(f"/api/tasks/{task['id']}")
    assert resp.status_code == 204
    get_resp = await client.get(f"/api/tasks/{task['id']}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_status_transition_valid(client: AsyncClient):
    """backlog -> todo -> in_progress -> review -> done"""
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    tid = task["id"]

    for new_status in ["todo", "in_progress", "review", "done"]:
        resp = await client.patch(f"/api/tasks/{tid}/status", json={"status": new_status})
        assert resp.status_code == 200, f"Failed transition to {new_status}"
        assert resp.json()["status"] == new_status


@pytest.mark.asyncio
async def test_status_transition_invalid(client: AsyncClient):
    """backlog -> done should fail (not allowed)"""
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    resp = await client.patch(
        f"/api/tasks/{task['id']}/status", json={"status": "done"}
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_status_transition_to_blocked(client: AsyncClient):
    """Any status can go to blocked"""
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    resp = await client.patch(
        f"/api/tasks/{task['id']}/status", json={"status": "blocked"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "blocked"


@pytest.mark.asyncio
async def test_blocked_to_todo(client: AsyncClient):
    """blocked -> todo is valid"""
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    await client.patch(f"/api/tasks/{task['id']}/status", json={"status": "blocked"})
    resp = await client.patch(f"/api/tasks/{task['id']}/status", json={"status": "todo"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "todo"


@pytest.mark.asyncio
async def test_history_recorded_on_status_change(client: AsyncClient):
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    tid = task["id"]
    await client.patch(f"/api/tasks/{tid}/status", json={"status": "todo"})
    resp = await client.get(f"/api/tasks/{tid}/history")
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) >= 1
    entry = history[0]
    assert entry["field_name"] == "status"
    assert entry["old_value"] == "backlog"
    assert entry["new_value"] == "todo"


@pytest.mark.asyncio
async def test_update_position(client: AsyncClient):
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    tid = task["id"]
    # Move to todo and set sort_order
    await client.patch(f"/api/tasks/{tid}/status", json={"status": "todo"})
    resp = await client.patch(
        f"/api/tasks/{tid}/position", json={"status": "in_progress", "sort_order": 5}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"
    assert resp.json()["sort_order"] == 5


@pytest.mark.asyncio
async def test_update_position_invalid_transition(client: AsyncClient):
    pid = await _create_project(client)
    task = await _create_task(client, pid)
    # backlog -> done via position should fail
    resp = await client.patch(
        f"/api/tasks/{task['id']}/position", json={"status": "done", "sort_order": 0}
    )
    assert resp.status_code == 422
