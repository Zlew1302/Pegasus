"""Tests for MCP server management endpoints."""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mcp_server import McpServer


# ── Fixtures ──────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_server(db_session: AsyncSession) -> McpServer:
    """Create a sample MCP server for testing."""
    server = McpServer(
        id="test-server-001",
        name="Test Server",
        slug="test-server",
        description="Ein Test-MCP-Server",
        server_url="https://mcp.test.example.com",
        auth_type="bearer",
        auth_token_encrypted="test-token-123",
        icon="plug",
        is_connected=False,
    )
    db_session.add(server)
    await db_session.commit()
    await db_session.refresh(server)
    return server


# ── CRUD Tests ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_servers_empty(client: AsyncClient):
    """Leere Server-Liste zurückgeben."""
    resp = await client.get("/api/mcp/servers")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_server(client: AsyncClient):
    """Neuen MCP-Server erstellen."""
    resp = await client.post("/api/mcp/servers", json={
        "name": "GitHub MCP",
        "slug": "github",
        "server_url": "https://mcp.github.com",
        "description": "GitHub Integration",
        "auth_type": "bearer",
        "auth_token": "ghp_test123",
        "icon": "github",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "GitHub MCP"
    assert data["slug"] == "github"
    assert data["server_url"] == "https://mcp.github.com"
    assert data["is_connected"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_create_server_duplicate_slug(client: AsyncClient, sample_server: McpServer):
    """Duplikat-Slug abweisen."""
    resp = await client.post("/api/mcp/servers", json={
        "name": "Duplicate",
        "slug": sample_server.slug,
        "server_url": "https://other.example.com",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_list_servers_with_data(client: AsyncClient, sample_server: McpServer):
    """Server-Liste mit Daten zurückgeben."""
    resp = await client.get("/api/mcp/servers")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test Server"
    assert data[0]["slug"] == "test-server"
    assert data[0]["tool_count"] == 0


@pytest.mark.asyncio
async def test_get_server(client: AsyncClient, sample_server: McpServer):
    """Einzelnen Server abrufen."""
    resp = await client.get(f"/api/mcp/servers/{sample_server.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Server"
    assert data["server_url"] == "https://mcp.test.example.com"


@pytest.mark.asyncio
async def test_get_server_not_found(client: AsyncClient):
    """404 bei nicht vorhandenem Server."""
    resp = await client.get("/api/mcp/servers/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_server(client: AsyncClient, sample_server: McpServer):
    """Server aktualisieren."""
    resp = await client.patch(f"/api/mcp/servers/{sample_server.id}", json={
        "name": "Updated Server",
        "description": "Neue Beschreibung",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Server"
    assert data["description"] == "Neue Beschreibung"
    # Unveränderte Felder bleiben
    assert data["server_url"] == "https://mcp.test.example.com"


@pytest.mark.asyncio
async def test_update_server_not_found(client: AsyncClient):
    """404 bei nicht vorhandenem Server."""
    resp = await client.patch("/api/mcp/servers/nonexistent-id", json={
        "name": "Updated",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_server(client: AsyncClient, sample_server: McpServer):
    """Server löschen."""
    resp = await client.delete(f"/api/mcp/servers/{sample_server.id}")
    assert resp.status_code == 204

    # Verify deleted
    resp = await client.get(f"/api/mcp/servers/{sample_server.id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_server_not_found(client: AsyncClient):
    """404 bei nicht vorhandenem Server."""
    resp = await client.delete("/api/mcp/servers/nonexistent-id")
    assert resp.status_code == 404


# ── Disconnect Test ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_disconnect_server(client: AsyncClient, db_session: AsyncSession):
    """Verbundenen Server trennen."""
    server = McpServer(
        id="test-connected-001",
        name="Connected Server",
        slug="connected-test",
        server_url="https://mcp.connected.example.com",
        is_connected=True,
        available_tools='[{"name":"tool1","description":"Test"}]',
    )
    db_session.add(server)
    await db_session.commit()

    resp = await client.post(f"/api/mcp/servers/{server.id}/disconnect")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_connected"] is False


# ── Tools Test ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_server_tools_empty(client: AsyncClient, sample_server: McpServer):
    """Leere Tool-Liste für Server ohne Tools."""
    resp = await client.get(f"/api/mcp/servers/{sample_server.id}/tools")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_server_tools_with_data(client: AsyncClient, db_session: AsyncSession):
    """Tool-Liste für Server mit gecachten Tools."""
    import json
    server = McpServer(
        id="test-tools-001",
        name="Tools Server",
        slug="tools-test",
        server_url="https://mcp.tools.example.com",
        is_connected=True,
        available_tools=json.dumps([
            {"name": "search", "description": "Suche durchführen", "input_schema": {"type": "object"}},
            {"name": "create", "description": "Erstellen", "input_schema": None},
        ]),
    )
    db_session.add(server)
    await db_session.commit()

    resp = await client.get(f"/api/mcp/servers/{server.id}/tools")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["name"] == "search"
    assert data[1]["name"] == "create"


# ── Health-Check Test ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_test_server_not_found(client: AsyncClient):
    """404 bei Health-Check für nicht vorhandenen Server."""
    resp = await client.post("/api/mcp/servers/nonexistent-id/test")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_servers_tool_count(client: AsyncClient, db_session: AsyncSession):
    """Tool-Count in Server-Liste korrekt berechnet."""
    import json
    server = McpServer(
        id="test-count-001",
        name="Count Server",
        slug="count-test",
        server_url="https://mcp.count.example.com",
        is_connected=True,
        available_tools=json.dumps([
            {"name": "t1", "description": "Tool 1"},
            {"name": "t2", "description": "Tool 2"},
            {"name": "t3", "description": "Tool 3"},
        ]),
    )
    db_session.add(server)
    await db_session.commit()

    resp = await client.get("/api/mcp/servers")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["tool_count"] == 3
