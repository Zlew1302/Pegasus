"""MCP Bridge — wraps MCP server tools as BaseTool instances for the agent system."""

import logging
from typing import Any

from sqlalchemy import select

from agents.tools.base import BaseTool, ToolContext
from app.services.mcp_client import McpToolDefinition

logger = logging.getLogger(__name__)


class McpBridgeTool(BaseTool):
    """Wraps a single MCP server tool as a BaseTool for the agent system."""

    def __init__(
        self,
        server_url: str,
        auth: str | None,
        tool_def: McpToolDefinition,
        server_name: str,
    ):
        self._server_url = server_url
        self._auth = auth
        self._tool_def = tool_def
        self._server_name = server_name

        # Prefixed name: "mcp_<server_slug>__<tool_name>"
        self.name = f"mcp_{server_name}__{tool_def.name}"
        self.description = (
            f"[{server_name}] {tool_def.description}"
            if tool_def.description
            else f"MCP-Tool '{tool_def.name}' von {server_name}"
        )

    def input_schema(self) -> dict[str, Any]:
        """Return the input schema from the MCP tool definition."""
        if self._tool_def.input_schema:
            return self._tool_def.input_schema
        # Fallback: leeres Schema
        return {
            "type": "object",
            "properties": {},
        }

    async def execute(self, parameters: dict[str, Any], context: ToolContext) -> str:
        """Call the MCP server tool and return the result."""
        from app.services.mcp_client import call_tool

        logger.info(
            "MCP-Tool-Call: %s/%s mit %d Parametern",
            self._server_name,
            self._tool_def.name,
            len(parameters),
        )

        result = await call_tool(
            server_url=self._server_url,
            auth=self._auth,
            tool_name=self._tool_def.name,
            arguments=parameters,
        )

        return result


async def load_mcp_tools(session_factory) -> list[McpBridgeTool]:
    """Lade alle Tools von allen verbundenen MCP-Servern.

    Returns eine Liste von McpBridgeTool-Instanzen, die als reguläre
    Agent-Tools verwendet werden können.
    """
    from app.models.mcp_server import McpServer
    from app.services.mcp_client import discover_tools

    tools: list[McpBridgeTool] = []

    try:
        async with session_factory() as db:
            result = await db.execute(
                select(McpServer).where(McpServer.is_connected == True)  # noqa: E712
            )
            servers = list(result.scalars().all())

        for server in servers:
            try:
                # Lade auth token
                auth = server.auth_token_encrypted  # TODO: Entschlüsselung

                # Discover tools
                tool_defs = await discover_tools(
                    server_url=server.server_url,
                    auth=auth,
                )

                for tool_def in tool_defs:
                    bridge_tool = McpBridgeTool(
                        server_url=server.server_url,
                        auth=auth,
                        tool_def=tool_def,
                        server_name=server.slug,
                    )
                    tools.append(bridge_tool)

                logger.info(
                    "MCP-Server '%s': %d Tools geladen",
                    server.name, len(tool_defs),
                )

            except Exception as e:
                logger.warning(
                    "MCP-Server '%s': Tools konnten nicht geladen werden: %s",
                    server.name, str(e),
                )

    except Exception as e:
        logger.warning("Fehler beim Laden der MCP-Tools: %s", str(e))

    return tools
