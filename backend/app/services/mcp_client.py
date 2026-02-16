"""MCP Client Service — communicates with MCP servers via HTTP (JSON-RPC 2.0 subset)."""

import json
import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

MCP_TIMEOUT = 30.0  # Sekunden


@dataclass
class McpToolDefinition:
    """Definition eines einzelnen MCP-Tools."""
    name: str
    description: str = ""
    input_schema: dict | None = None


async def discover_tools(
    server_url: str,
    auth: str | None = None,
) -> list[McpToolDefinition]:
    """Entdecke verfügbare Tools eines MCP-Servers.

    Sendet eine `tools/list` JSON-RPC Anfrage an den Server.
    """
    headers = _build_headers(auth)

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {},
    }

    try:
        async with httpx.AsyncClient(timeout=MCP_TIMEOUT) as client:
            response = await client.post(server_url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()

            # JSON-RPC Fehler prüfen
            if "error" in data:
                logger.warning(
                    "MCP-Server %s Fehler bei tools/list: %s",
                    server_url, data["error"],
                )
                return []

            result = data.get("result", {})
            tools_raw = result.get("tools", [])

            tools: list[McpToolDefinition] = []
            for t in tools_raw:
                tools.append(McpToolDefinition(
                    name=t.get("name", "unknown"),
                    description=t.get("description", ""),
                    input_schema=t.get("inputSchema"),
                ))

            logger.info(
                "MCP-Server %s: %d Tools entdeckt",
                server_url, len(tools),
            )
            return tools

    except httpx.TimeoutException:
        logger.warning("MCP-Server %s: Timeout bei tools/list", server_url)
        return []
    except httpx.HTTPStatusError as e:
        logger.warning("MCP-Server %s: HTTP %d", server_url, e.response.status_code)
        return []
    except Exception as e:
        logger.warning("MCP-Server %s: Fehler bei tools/list: %s", server_url, str(e))
        return []


async def call_tool(
    server_url: str,
    auth: str | None,
    tool_name: str,
    arguments: dict,
) -> str:
    """Rufe ein Tool auf einem MCP-Server auf.

    Sendet eine `tools/call` JSON-RPC Anfrage und gibt das Ergebnis als String zurück.
    """
    headers = _build_headers(auth)

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=MCP_TIMEOUT) as client:
            response = await client.post(server_url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()

            if "error" in data:
                error = data["error"]
                msg = error.get("message", str(error))
                logger.warning(
                    "MCP-Tool %s/%s Fehler: %s",
                    server_url, tool_name, msg,
                )
                return f"Fehler beim Ausführen von '{tool_name}': {msg}"

            result = data.get("result", {})

            # MCP gibt content als Array zurück
            content = result.get("content", [])
            if isinstance(content, list):
                text_parts = []
                for item in content:
                    if isinstance(item, dict):
                        if item.get("type") == "text":
                            text_parts.append(item.get("text", ""))
                        elif item.get("type") == "image":
                            text_parts.append("[Bild-Inhalt]")
                        else:
                            text_parts.append(json.dumps(item, ensure_ascii=False))
                    else:
                        text_parts.append(str(item))
                return "\n".join(text_parts) if text_parts else json.dumps(result, ensure_ascii=False)

            return json.dumps(result, ensure_ascii=False)

    except httpx.TimeoutException:
        return f"Fehler: Timeout beim Aufruf von '{tool_name}' auf {server_url}"
    except httpx.HTTPStatusError as e:
        return f"Fehler: HTTP {e.response.status_code} beim Aufruf von '{tool_name}'"
    except Exception as e:
        return f"Fehler beim Aufruf von '{tool_name}': {str(e)}"


async def health_check(
    server_url: str,
    auth: str | None = None,
) -> bool:
    """Prüfe ob ein MCP-Server erreichbar ist.

    Sendet eine einfache `ping` oder `tools/list` Anfrage.
    """
    headers = _build_headers(auth)

    # Versuch 1: ping
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "ping",
        "params": {},
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(server_url, json=payload, headers=headers)
            if response.status_code == 200:
                return True

            # Fallback: tools/list als Health-Check
            payload["method"] = "tools/list"
            response = await client.post(server_url, json=payload, headers=headers)
            return response.status_code == 200

    except Exception:
        return False


def _build_headers(auth: str | None) -> dict[str, str]:
    """Erstelle HTTP-Headers mit optionaler Authentifizierung."""
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {auth}"
    return headers
