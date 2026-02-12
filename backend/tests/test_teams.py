import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_team(client: AsyncClient):
    resp = await client.post(
        "/api/teams",
        json={"name": "Alpha Team", "description": "Erstes Team"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Alpha Team"
    assert data["description"] == "Erstes Team"
    assert data["member_count"] == 0


@pytest.mark.asyncio
async def test_list_teams(client: AsyncClient):
    await client.post("/api/teams", json={"name": "Team A"})
    await client.post("/api/teams", json={"name": "Team B"})

    resp = await client.get("/api/teams")
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.asyncio
async def test_get_team(client: AsyncClient):
    create_resp = await client.post(
        "/api/teams",
        json={"name": "Detail Team"},
    )
    team_id = create_resp.json()["id"]

    resp = await client.get(f"/api/teams/{team_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Detail Team"


@pytest.mark.asyncio
async def test_update_team(client: AsyncClient):
    create_resp = await client.post(
        "/api/teams",
        json={"name": "Alt Name"},
    )
    team_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/teams/{team_id}",
        json={"name": "Neu Name", "description": "Beschreibung"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Neu Name"
    assert resp.json()["description"] == "Beschreibung"


@pytest.mark.asyncio
async def test_delete_team(client: AsyncClient):
    create_resp = await client.post(
        "/api/teams",
        json={"name": "Zu loeschen"},
    )
    team_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/teams/{team_id}")
    assert resp.status_code == 204

    get_resp = await client.get(f"/api/teams/{team_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_add_member(client: AsyncClient):
    team_resp = await client.post(
        "/api/teams",
        json={"name": "Member Test"},
    )
    team_id = team_resp.json()["id"]

    resp = await client.post(
        f"/api/teams/{team_id}/members",
        json={"member_type": "human", "member_id": "user-1", "role": "lead"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["member_type"] == "human"
    assert data["member_id"] == "user-1"
    assert data["role"] == "lead"


@pytest.mark.asyncio
async def test_add_duplicate_member_rejected(client: AsyncClient):
    team_resp = await client.post(
        "/api/teams",
        json={"name": "Dup Test"},
    )
    team_id = team_resp.json()["id"]

    await client.post(
        f"/api/teams/{team_id}/members",
        json={"member_type": "human", "member_id": "user-dup"},
    )
    resp = await client.post(
        f"/api/teams/{team_id}/members",
        json={"member_type": "human", "member_id": "user-dup"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_remove_member(client: AsyncClient):
    team_resp = await client.post(
        "/api/teams",
        json={"name": "Remove Test"},
    )
    team_id = team_resp.json()["id"]

    await client.post(
        f"/api/teams/{team_id}/members",
        json={"member_type": "agent", "member_id": "agent-1"},
    )

    resp = await client.delete(f"/api/teams/{team_id}/members/agent-1")
    assert resp.status_code == 204

    list_resp = await client.get(f"/api/teams/{team_id}/members")
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_list_members(client: AsyncClient):
    team_resp = await client.post(
        "/api/teams",
        json={"name": "List Members"},
    )
    team_id = team_resp.json()["id"]

    await client.post(
        f"/api/teams/{team_id}/members",
        json={"member_type": "human", "member_id": "u1"},
    )
    await client.post(
        f"/api/teams/{team_id}/members",
        json={"member_type": "agent", "member_id": "a1"},
    )

    resp = await client.get(f"/api/teams/{team_id}/members")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_delete_team_cascades_members(client: AsyncClient):
    team_resp = await client.post(
        "/api/teams",
        json={"name": "Cascade Test"},
    )
    team_id = team_resp.json()["id"]

    await client.post(
        f"/api/teams/{team_id}/members",
        json={"member_type": "human", "member_id": "cascade-user"},
    )

    resp = await client.delete(f"/api/teams/{team_id}")
    assert resp.status_code == 204

    # Team should not exist anymore
    get_resp = await client.get(f"/api/teams/{team_id}")
    assert get_resp.status_code == 404
