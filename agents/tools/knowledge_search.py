"""Knowledge search tool for agents — searches the RAG knowledge base."""

from typing import Any

from agents.tools.base import BaseTool, ToolContext
from app.services import knowledge_service


class KnowledgeSearchTool(BaseTool):
    """Search the knowledge base for relevant documents and information."""

    name = "search_knowledge"
    description = (
        "Durchsucht die Wissensbasis nach relevanten Dokumenten und Informationen. "
        "Nutze dieses Tool, wenn du Kontext aus hochgeladenen Dokumenten brauchst."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Die Suchanfrage — beschreibe möglichst genau, welche Information du suchst.",
                },
                "scope": {
                    "type": "string",
                    "enum": ["global", "project", "all"],
                    "description": (
                        "'global' = nur globale Dokumente, "
                        "'project' = nur Projekt-Dokumente, "
                        "'all' = beides (Standard)"
                    ),
                    "default": "all",
                },
            },
            "required": ["query"],
        }

    async def execute(self, parameters: dict[str, Any], context: ToolContext) -> str:
        query = parameters.get("query", "")
        scope = parameters.get("scope", "all")

        if not query:
            return "Fehler: Keine Suchanfrage angegeben."

        # Determine project_id based on scope
        project_id = None
        if scope in ("project", "all") and context.briefing and context.briefing.project_id:
            project_id = context.briefing.project_id

        # If scope is "global", explicitly pass no project_id
        if scope == "global":
            project_id = None

        user_id = (
            context.briefing.user_id
            if context.briefing and hasattr(context.briefing, "user_id")
            else "default-user"
        )

        results = await knowledge_service.search(
            query=query,
            user_id=user_id,
            session_factory=context.session_factory,
            project_id=project_id,
            top_k=5,
        )

        if not results:
            return "Keine relevanten Dokumente in der Wissensbasis gefunden."

        # Format results
        parts = [f"Gefundene Ergebnisse ({len(results)}):\n"]
        for i, r in enumerate(results, 1):
            score_pct = int(r["score"] * 100)
            parts.append(
                f"### {i}. {r['document_title']} (Relevanz: {score_pct}%)\n"
                f"{r['chunk_content']}\n"
                f"---"
            )

        return "\n".join(parts)
