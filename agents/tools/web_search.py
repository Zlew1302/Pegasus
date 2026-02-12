"""Web search tool using Brave Search API."""

from typing import Any

import httpx

from agents.tools.base import BaseTool, ToolContext
from app.config import settings


class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Sucht im Internet nach aktuellen Informationen. Gibt Titel, URLs und Kurzbeschreibungen zurueck."

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Der Suchbegriff",
                },
                "count": {
                    "type": "integer",
                    "description": "Anzahl der Ergebnisse (1-5)",
                    "default": 3,
                },
            },
            "required": ["query"],
        }

    async def execute(self, parameters: dict[str, Any], context: ToolContext) -> str:
        query = parameters.get("query", "")
        count = min(parameters.get("count", 3), 5)

        if not query:
            return "Fehler: Kein Suchbegriff angegeben."

        api_key = settings.BRAVE_API_KEY
        if not api_key:
            return (
                f"Kein Brave Search API-Key konfiguriert. "
                f"Nutze dein internes Wissen um '{query}' zu beantworten. "
                f"Hinweis: Ergebnisse basieren auf dem Trainingswissen, nicht auf Live-Daten."
            )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    params={"q": query, "count": count},
                    headers={
                        "Accept": "application/json",
                        "X-Subscription-Token": api_key,
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            results = data.get("web", {}).get("results", [])
            if not results:
                return f"Keine Ergebnisse fuer '{query}' gefunden."

            output_lines = [f"## Suchergebnisse fuer: {query}\n"]
            for i, r in enumerate(results[:count], 1):
                title = r.get("title", "Kein Titel")
                url = r.get("url", "")
                desc = r.get("description", "Keine Beschreibung")
                output_lines.append(f"### {i}. {title}")
                output_lines.append(f"URL: {url}")
                output_lines.append(f"{desc}\n")

            return "\n".join(output_lines)

        except httpx.HTTPError as e:
            return f"Fehler bei der Web-Suche: {str(e)}"
