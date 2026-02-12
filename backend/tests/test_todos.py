import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_todos_empty(client: AsyncClient):
    resp = await client.get("/api/todos")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_todo(client: AsyncClient):
    resp = await client.post("/api/todos", json={"title": "Einkaufen gehen"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Einkaufen gehen"
    assert data["is_completed"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_update_todo(client: AsyncClient):
    create = await client.post("/api/todos", json={"title": "Alt"})
    tid = create.json()["id"]
    resp = await client.patch(f"/api/todos/{tid}", json={"title": "Neu"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Neu"


@pytest.mark.asyncio
async def test_toggle_todo_completion(client: AsyncClient):
    create = await client.post("/api/todos", json={"title": "Erledigen"})
    tid = create.json()["id"]
    resp = await client.patch(f"/api/todos/{tid}", json={"is_completed": True})
    assert resp.status_code == 200
    assert resp.json()["is_completed"] is True


@pytest.mark.asyncio
async def test_delete_todo(client: AsyncClient):
    create = await client.post("/api/todos", json={"title": "Loeschen"})
    tid = create.json()["id"]
    resp = await client.delete(f"/api/todos/{tid}")
    assert resp.status_code == 204
    # Verify deleted
    list_resp = await client.get("/api/todos")
    assert all(t["id"] != tid for t in list_resp.json())


@pytest.mark.asyncio
async def test_todo_sort_order(client: AsyncClient):
    await client.post("/api/todos", json={"title": "Zweite", "sort_order": 2})
    await client.post("/api/todos", json={"title": "Erste", "sort_order": 1})
    resp = await client.get("/api/todos")
    todos = resp.json()
    assert len(todos) >= 2
    assert todos[0]["title"] == "Erste"
    assert todos[1]["title"] == "Zweite"


@pytest.mark.asyncio
async def test_update_todo_not_found(client: AsyncClient):
    resp = await client.patch("/api/todos/nonexistent", json={"title": "X"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_todo_not_found(client: AsyncClient):
    resp = await client.delete("/api/todos/nonexistent")
    assert resp.status_code == 404
