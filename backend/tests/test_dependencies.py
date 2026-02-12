import pytest
from httpx import AsyncClient


@pytest.fixture
async def project_with_tasks(client: AsyncClient):
    """Create a project with two tasks for dependency testing."""
    proj_resp = await client.post(
        "/api/projects",
        json={"title": "Dep Test Projekt"},
    )
    project = proj_resp.json()
    pid = project["id"]

    t1_resp = await client.post(
        f"/api/projects/{pid}/tasks",
        json={"title": "Task A", "status": "todo"},
    )
    t2_resp = await client.post(
        f"/api/projects/{pid}/tasks",
        json={"title": "Task B", "status": "todo"},
    )
    t3_resp = await client.post(
        f"/api/projects/{pid}/tasks",
        json={"title": "Task C", "status": "todo"},
    )

    return {
        "project": project,
        "task_a": t1_resp.json(),
        "task_b": t2_resp.json(),
        "task_c": t3_resp.json(),
    }


@pytest.mark.asyncio
async def test_add_dependency(client: AsyncClient, project_with_tasks: dict):
    task_a = project_with_tasks["task_a"]
    task_b = project_with_tasks["task_b"]

    resp = await client.post(
        f"/api/tasks/{task_b['id']}/dependencies",
        json={"depends_on_task_id": task_a["id"]},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["task_id"] == task_b["id"]
    assert data["depends_on_task_id"] == task_a["id"]
    assert data["depends_on_title"] == "Task A"
    assert data["depends_on_status"] == "todo"


@pytest.mark.asyncio
async def test_list_dependencies(client: AsyncClient, project_with_tasks: dict):
    task_a = project_with_tasks["task_a"]
    task_b = project_with_tasks["task_b"]

    await client.post(
        f"/api/tasks/{task_b['id']}/dependencies",
        json={"depends_on_task_id": task_a["id"]},
    )

    resp = await client.get(f"/api/tasks/{task_b['id']}/dependencies")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["depends_on_title"] == "Task A"


@pytest.mark.asyncio
async def test_add_dependency_self_reference(
    client: AsyncClient, project_with_tasks: dict
):
    task_a = project_with_tasks["task_a"]

    resp = await client.post(
        f"/api/tasks/{task_a['id']}/dependencies",
        json={"depends_on_task_id": task_a["id"]},
    )
    assert resp.status_code == 422
    assert "sich selbst" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_add_dependency_duplicate(
    client: AsyncClient, project_with_tasks: dict
):
    task_a = project_with_tasks["task_a"]
    task_b = project_with_tasks["task_b"]

    await client.post(
        f"/api/tasks/{task_b['id']}/dependencies",
        json={"depends_on_task_id": task_a["id"]},
    )

    resp = await client.post(
        f"/api/tasks/{task_b['id']}/dependencies",
        json={"depends_on_task_id": task_a["id"]},
    )
    assert resp.status_code == 422
    assert "existiert bereits" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_add_dependency_task_not_found(client: AsyncClient):
    resp = await client.post(
        "/api/tasks/nonexistent/dependencies",
        json={"depends_on_task_id": "also-nonexistent"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_remove_dependency(client: AsyncClient, project_with_tasks: dict):
    task_a = project_with_tasks["task_a"]
    task_b = project_with_tasks["task_b"]

    await client.post(
        f"/api/tasks/{task_b['id']}/dependencies",
        json={"depends_on_task_id": task_a["id"]},
    )

    resp = await client.delete(
        f"/api/tasks/{task_b['id']}/dependencies/{task_a['id']}"
    )
    assert resp.status_code == 204

    # Verify removed
    list_resp = await client.get(f"/api/tasks/{task_b['id']}/dependencies")
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_status_blocked_by_dependency(
    client: AsyncClient, project_with_tasks: dict
):
    """Task B depends on Task A (todo). Moving B to in_progress should fail."""
    task_a = project_with_tasks["task_a"]
    task_b = project_with_tasks["task_b"]

    # Add dependency: B depends on A
    await client.post(
        f"/api/tasks/{task_b['id']}/dependencies",
        json={"depends_on_task_id": task_a["id"]},
    )

    # Try to move B to in_progress — should fail
    resp = await client.patch(
        f"/api/tasks/{task_b['id']}/status",
        json={"status": "in_progress"},
    )
    assert resp.status_code == 422
    assert "Abhaengigkeiten noch nicht erledigt" in resp.json()["detail"]
    assert "Task A" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_status_allowed_when_dependency_done(
    client: AsyncClient, project_with_tasks: dict
):
    """Task B depends on Task A. After A is done, B can move to in_progress."""
    task_a = project_with_tasks["task_a"]
    task_b = project_with_tasks["task_b"]

    # Add dependency: B depends on A
    await client.post(
        f"/api/tasks/{task_b['id']}/dependencies",
        json={"depends_on_task_id": task_a["id"]},
    )

    # Move A through: todo -> in_progress -> done
    await client.patch(
        f"/api/tasks/{task_a['id']}/status",
        json={"status": "in_progress"},
    )
    await client.patch(
        f"/api/tasks/{task_a['id']}/status",
        json={"status": "done"},
    )

    # Now B should be able to move to in_progress
    resp = await client.patch(
        f"/api/tasks/{task_b['id']}/status",
        json={"status": "in_progress"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"
