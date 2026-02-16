"""MCP Server management router."""

import json
import logging
from datetime import datetime, UTC
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.mcp_server import McpServer
from app.schemas.mcp_server import (
    McpServerCreate,
    McpServerListResponse,
    McpServerResponse,
    McpServerUpdate,
    McpToolDefinition,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


# ── List all MCP servers ───────────────────────────────────

@router.get("/servers", response_model=list[McpServerListResponse])
async def list_servers(db: AsyncSession = Depends(get_db)):
    """Alle registrierten MCP-Server auflisten."""
    result = await db.execute(
        select(McpServer).order_by(McpServer.name)
    )
    servers = list(result.scalars().all())

    response = []
    for s in servers:
        tool_count = 0
        if s.available_tools:
            try:
                tool_count = len(json.loads(s.available_tools))
            except (json.JSONDecodeError, TypeError):
                pass

        response.append(McpServerListResponse(
            id=s.id,
            name=s.name,
            slug=s.slug,
            description=s.description,
            icon=s.icon,
            is_connected=s.is_connected,
            server_url=s.server_url,
            auth_type=s.auth_type,
            last_health_check=s.last_health_check,
            tool_count=tool_count,
        ))

    return response


# ── Create a new MCP server ────────────────────────────────

@router.post("/servers", response_model=McpServerResponse, status_code=201)
async def create_server(
    data: McpServerCreate,
    db: AsyncSession = Depends(get_db),
):
    """Neuen MCP-Server registrieren."""
    # Prüfe ob slug bereits existiert
    existing = await db.execute(
        select(McpServer).where(McpServer.slug == data.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Ein MCP-Server mit diesem Slug existiert bereits")

    server = McpServer(
        id=str(uuid4()),
        name=data.name,
        slug=data.slug,
        description=data.description,
        server_url=data.server_url,
        auth_type=data.auth_type,
        auth_token_encrypted=data.auth_token,  # TODO: verschlüsseln
        icon=data.icon,
    )
    db.add(server)
    await db.commit()
    await db.refresh(server)
    return server


# ── Get a single MCP server ────────────────────────────────

@router.get("/servers/{server_id}", response_model=McpServerResponse)
async def get_server(
    server_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Einen MCP-Server abrufen."""
    server = await db.get(McpServer, server_id)
    if not server:
        raise HTTPException(404, "MCP-Server nicht gefunden")
    return server


# ── Update a MCP server ────────────────────────────────────

@router.patch("/servers/{server_id}", response_model=McpServerResponse)
async def update_server(
    server_id: str,
    data: McpServerUpdate,
    db: AsyncSession = Depends(get_db),
):
    """MCP-Server aktualisieren."""
    server = await db.get(McpServer, server_id)
    if not server:
        raise HTTPException(404, "MCP-Server nicht gefunden")

    if data.name is not None:
        server.name = data.name
    if data.description is not None:
        server.description = data.description
    if data.server_url is not None:
        server.server_url = data.server_url
    if data.auth_type is not None:
        server.auth_type = data.auth_type
    if data.auth_token is not None:
        server.auth_token_encrypted = data.auth_token  # TODO: verschlüsseln
    if data.icon is not None:
        server.icon = data.icon

    await db.commit()
    await db.refresh(server)
    return server


# ── Delete a MCP server ────────────────────────────────────

@router.delete("/servers/{server_id}", status_code=204)
async def delete_server(
    server_id: str,
    db: AsyncSession = Depends(get_db),
):
    """MCP-Server entfernen."""
    server = await db.get(McpServer, server_id)
    if not server:
        raise HTTPException(404, "MCP-Server nicht gefunden")

    await db.delete(server)
    await db.commit()


# ── Connect to a MCP server ───────────────────────────────

@router.post("/servers/{server_id}/connect", response_model=McpServerResponse)
async def connect_server(
    server_id: str,
    db: AsyncSession = Depends(get_db),
):
    """MCP-Server verbinden: Health-Check + Tool-Discovery."""
    from app.services.mcp_client import discover_tools, health_check

    server = await db.get(McpServer, server_id)
    if not server:
        raise HTTPException(404, "MCP-Server nicht gefunden")

    auth = server.auth_token_encrypted  # TODO: entschlüsseln

    # Health-Check
    is_healthy = await health_check(server.server_url, auth)
    if not is_healthy:
        raise HTTPException(
            502,
            f"MCP-Server '{server.name}' ist nicht erreichbar unter {server.server_url}",
        )

    # Tool-Discovery
    tools = await discover_tools(server.server_url, auth)

    # Speichere Tools als JSON
    tools_data = [
        {"name": t.name, "description": t.description, "input_schema": t.input_schema}
        for t in tools
    ]
    server.available_tools = json.dumps(tools_data, ensure_ascii=False)
    server.is_connected = True
    server.last_health_check = datetime.now(UTC)

    await db.commit()
    await db.refresh(server)
    return server


# ── Disconnect from a MCP server ──────────────────────────

@router.post("/servers/{server_id}/disconnect", response_model=McpServerResponse)
async def disconnect_server(
    server_id: str,
    db: AsyncSession = Depends(get_db),
):
    """MCP-Server trennen."""
    server = await db.get(McpServer, server_id)
    if not server:
        raise HTTPException(404, "MCP-Server nicht gefunden")

    server.is_connected = False
    await db.commit()
    await db.refresh(server)
    return server


# ── Get tools from a MCP server ───────────────────────────

@router.get("/servers/{server_id}/tools", response_model=list[McpToolDefinition])
async def get_server_tools(
    server_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Verfügbare Tools eines MCP-Servers abrufen."""
    server = await db.get(McpServer, server_id)
    if not server:
        raise HTTPException(404, "MCP-Server nicht gefunden")

    if not server.available_tools:
        return []

    try:
        tools_data = json.loads(server.available_tools)
        return [
            McpToolDefinition(
                name=t.get("name", "unknown"),
                description=t.get("description", ""),
                input_schema=t.get("input_schema"),
            )
            for t in tools_data
        ]
    except (json.JSONDecodeError, TypeError):
        return []


# ── Test / Health-Check a MCP server ──────────────────────

@router.post("/servers/{server_id}/test")
async def test_server(
    server_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Health-Check für einen MCP-Server ausführen."""
    from app.services.mcp_client import health_check

    server = await db.get(McpServer, server_id)
    if not server:
        raise HTTPException(404, "MCP-Server nicht gefunden")

    auth = server.auth_token_encrypted  # TODO: entschlüsseln
    is_healthy = await health_check(server.server_url, auth)

    if is_healthy:
        server.last_health_check = datetime.now(UTC)
        await db.commit()

    return {"healthy": is_healthy, "server_url": server.server_url}
