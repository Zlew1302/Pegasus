import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_notification(client: AsyncClient):
    resp = await client.post(
        "/api/notifications",
        json={
            "type": "approval_needed",
            "title": "Freigabe noetig",
            "message": "Task XY braucht Freigabe",
            "priority": "high",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Freigabe noetig"
    assert data["type"] == "approval_needed"
    assert data["is_read"] is False


@pytest.mark.asyncio
async def test_list_notifications(client: AsyncClient):
    await client.post(
        "/api/notifications",
        json={"type": "info", "title": "Erste"},
    )
    await client.post(
        "/api/notifications",
        json={"type": "info", "title": "Zweite"},
    )

    resp = await client.get("/api/notifications")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_list_unread_only(client: AsyncClient):
    create_resp = await client.post(
        "/api/notifications",
        json={"type": "info", "title": "Ungelesen"},
    )
    notif_id = create_resp.json()["id"]

    # Mark it as read
    await client.patch(
        "/api/notifications/mark-read",
        json={"ids": [notif_id]},
    )

    # Create another unread
    await client.post(
        "/api/notifications",
        json={"type": "info", "title": "Noch ungelesen"},
    )

    resp = await client.get("/api/notifications?unread_only=true")
    assert resp.status_code == 200
    data = resp.json()
    for n in data:
        assert n["is_read"] is False


@pytest.mark.asyncio
async def test_unread_count(client: AsyncClient):
    await client.post(
        "/api/notifications",
        json={"type": "info", "title": "Test A"},
    )
    await client.post(
        "/api/notifications",
        json={"type": "info", "title": "Test B"},
    )

    resp = await client.get("/api/notifications/unread-count")
    assert resp.status_code == 200
    assert resp.json()["count"] >= 2


@pytest.mark.asyncio
async def test_mark_read(client: AsyncClient):
    create_resp = await client.post(
        "/api/notifications",
        json={"type": "info", "title": "Zu lesen"},
    )
    notif_id = create_resp.json()["id"]

    resp = await client.patch(
        "/api/notifications/mark-read",
        json={"ids": [notif_id]},
    )
    assert resp.status_code == 200
    assert resp.json()["marked"] == 1

    # Verify it's read
    list_resp = await client.get("/api/notifications?unread_only=true")
    ids = [n["id"] for n in list_resp.json()]
    assert notif_id not in ids


@pytest.mark.asyncio
async def test_mark_read_multiple(client: AsyncClient):
    r1 = await client.post(
        "/api/notifications",
        json={"type": "info", "title": "A"},
    )
    r2 = await client.post(
        "/api/notifications",
        json={"type": "info", "title": "B"},
    )

    resp = await client.patch(
        "/api/notifications/mark-read",
        json={"ids": [r1.json()["id"], r2.json()["id"]]},
    )
    assert resp.status_code == 200
    assert resp.json()["marked"] == 2


@pytest.mark.asyncio
async def test_delete_notification(client: AsyncClient):
    create_resp = await client.post(
        "/api/notifications",
        json={"type": "info", "title": "Zu loeschen"},
    )
    notif_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/notifications/{notif_id}")
    assert resp.status_code == 204

    # Verify deleted
    resp2 = await client.delete(f"/api/notifications/{notif_id}")
    assert resp2.status_code == 404
