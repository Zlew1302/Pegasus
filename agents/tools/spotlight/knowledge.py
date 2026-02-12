"""Knowledge search tool for Spotlight — searches the RAG knowledge base."""

from typing import Any

from agents.tools.spotlight.context import SpotlightToolContext
from app.services import knowledge_service


class SpotlightKnowledgeSearchTool:
    """Search the knowledge base from within Spotlight."""

    name = "search_knowledge"
    description = (
        "Durchsucht die Wissensbasis nach relevanten Dokumenten und Informationen. "
        "Nutze dieses Tool bei Fragen zu hochgeladenen Dokumenten oder wenn Kontext benoetigt wird."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Die Suchanfrage — beschreibe moeglichst genau, welche Information du suchst.",
                },
            },
            "required": ["query"],
        }

    def to_anthropic_format(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema(),
        }

    async def execute(self, parameters: dict[str, Any], context: SpotlightToolContext) -> str:
        query = parameters.get("query", "")
        if not query:
            return "Fehler: Keine Suchanfrage angegeben."

        user_id = context.user_id

        # Determine project_id from current context (if on a project page)
        project_id = context.current_entity_id if "/projects/" in context.current_path else None

        results = await knowledge_service.search(
            query=query,
            user_id=user_id,
            session_factory=context.session_factory,
            project_id=project_id,
            top_k=5,
        )

        if not results:
            return "Keine relevanten Dokumente in der Wissensbasis gefunden."

        parts = [f"Gefundene Ergebnisse ({len(results)}):\n"]
        for i, r in enumerate(results, 1):
            score_pct = int(r["score"] * 100)
            parts.append(
                f"### {i}. {r['document_title']} (Relevanz: {score_pct}%)\n"
                f"{r['chunk_content']}\n"
                f"---"
            )

        return "\n".join(parts)
