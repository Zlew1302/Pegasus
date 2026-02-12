import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_projects_empty(client: AsyncClient):
    resp = await client.get("/api/projects")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_project(client: AsyncClient):
    resp = await client.post("/api/projects", json={"title": "Test Projekt"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test Projekt"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_project_with_description(client: AsyncClient):
    resp = await client.post(
        "/api/projects",
        json={"title": "Projekt 2", "description": "Eine Beschreibung", "goal": "Ein Ziel"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == "Eine Beschreibung"
    assert data["goal"] == "Ein Ziel"


@pytest.mark.asyncio
async def test_get_project(client: AsyncClient):
    create_resp = await client.post("/api/projects", json={"title": "Mein Projekt"})
    pid = create_resp.json()["id"]
    resp = await client.get(f"/api/projects/{pid}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Mein Projekt"


@pytest.mark.asyncio
async def test_get_project_not_found(client: AsyncClient):
    resp = await client.get("/api/projects/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_project(client: AsyncClient):
    create_resp = await client.post("/api/projects", json={"title": "Alt"})
    pid = create_resp.json()["id"]
    resp = await client.patch(f"/api/projects/{pid}", json={"title": "Neu"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Neu"


@pytest.mark.asyncio
async def test_delete_project(client: AsyncClient):
    create_resp = await client.post("/api/projects", json={"title": "Loeschen"})
    pid = create_resp.json()["id"]
    resp = await client.delete(f"/api/projects/{pid}")
    assert resp.status_code == 204
    # Verify deleted
    get_resp = await client.get(f"/api/projects/{pid}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_list_projects_returns_task_count(client: AsyncClient):
    create_resp = await client.post("/api/projects", json={"title": "Mit Tasks"})
    pid = create_resp.json()["id"]
    await client.post(f"/api/projects/{pid}/tasks", json={"title": "Task 1"})
    await client.post(f"/api/projects/{pid}/tasks", json={"title": "Task 2"})
    resp = await client.get("/api/projects")
    projects = resp.json()
    project = next(p for p in projects if p["id"] == pid)
    assert project["task_count"] == 2


@pytest.mark.asyncio
async def test_create_project_validation(client: AsyncClient):
    resp = await client.post("/api/projects", json={})
    assert resp.status_code == 422
