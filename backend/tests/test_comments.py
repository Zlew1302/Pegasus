import pytest
from httpx import AsyncClient


@pytest.fixture
async def sample_project(client: AsyncClient) -> dict:
    resp = await client.post(
        "/api/projects",
        json={"title": "Test Projekt", "description": "Desc"},
    )
    return resp.json()


@pytest.fixture
async def sample_task(client: AsyncClient, sample_project: dict) -> dict:
    resp = await client.post(
        f"/api/projects/{sample_project['id']}/tasks",
        json={"title": "Test Task"},
    )
    return resp.json()


@pytest.mark.asyncio
async def test_create_comment(client: AsyncClient, sample_task: dict):
    resp = await client.post(
        f"/api/tasks/{sample_task['id']}/comments",
        json={
            "author_name": "Lukas",
            "content": "Das sieht gut aus!",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["author_name"] == "Lukas"
    assert data["content"] == "Das sieht gut aus!"
    assert data["author_type"] == "human"
    assert data["task_id"] == sample_task["id"]


@pytest.mark.asyncio
async def test_create_comment_agent_type(client: AsyncClient, sample_task: dict):
    resp = await client.post(
        f"/api/tasks/{sample_task['id']}/comments",
        json={
            "author_name": "Research Agent",
            "content": "Recherche abgeschlossen.",
            "author_type": "agent",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["author_type"] == "agent"


@pytest.mark.asyncio
async def test_list_comments(client: AsyncClient, sample_task: dict):
    # Create two comments
    await client.post(
        f"/api/tasks/{sample_task['id']}/comments",
        json={"author_name": "Lukas", "content": "Erster Kommentar"},
    )
    await client.post(
        f"/api/tasks/{sample_task['id']}/comments",
        json={"author_name": "Anna", "content": "Zweiter Kommentar"},
    )

    resp = await client.get(f"/api/tasks/{sample_task['id']}/comments")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["content"] == "Erster Kommentar"
    assert data[1]["content"] == "Zweiter Kommentar"


@pytest.mark.asyncio
async def test_list_comments_empty(client: AsyncClient, sample_task: dict):
    resp = await client.get(f"/api/tasks/{sample_task['id']}/comments")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_delete_comment(client: AsyncClient, sample_task: dict):
    create_resp = await client.post(
        f"/api/tasks/{sample_task['id']}/comments",
        json={"author_name": "Lukas", "content": "Zu loeschen"},
    )
    comment_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/comments/{comment_id}")
    assert resp.status_code == 204

    # Verify deleted
    list_resp = await client.get(f"/api/tasks/{sample_task['id']}/comments")
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_delete_comment_not_found(client: AsyncClient):
    resp = await client.delete("/api/comments/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_comment_task_not_found(client: AsyncClient):
    resp = await client.post(
        "/api/tasks/nonexistent/comments",
        json={"author_name": "Lukas", "content": "Test"},
    )
    assert resp.status_code == 404
