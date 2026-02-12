"""Search tool — queries DB for tasks, projects, agents."""

from typing import Any

from sqlalchemy import select

from agents.tools.spotlight.context import SpotlightToolContext
from app.models.project import Project
from app.models.task import Task
from app.models.agent import AgentType, AgentInstance


class SearchDataTool:
    name = "search_data"
    description = (
        "Durchsucht die CrewBoard-Datenbank nach Tasks, Projekten oder Agenten. "
        "Kann nach Titel, Status, Prioritaet und Projekt filtern. "
        "Nutze dieses Tool wenn der User nach bestimmten Eintraegen sucht."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "entity_type": {
                    "type": "string",
                    "enum": ["task", "project", "agent"],
                    "description": "Typ der gesuchten Entitaet",
                },
                "query": {
                    "type": "string",
                    "description": "Suchbegriff fuer Titel/Beschreibung",
                },
                "status": {
                    "type": "string",
                    "description": "Filter nach Status (z.B. 'todo', 'in_progress', 'done', 'active', 'running')",
                },
                "priority": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low"],
                    "description": "Filter nach Prioritaet (nur Tasks)",
                },
                "project_id": {
                    "type": "string",
                    "description": "Filter nach Projekt-ID (nur Tasks)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max Ergebnisse (Standard: 10)",
                    "default": 10,
                },
            },
            "required": ["entity_type"],
        }

    def to_anthropic_format(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema(),
        }

    async def execute(self, parameters: dict[str, Any], context: SpotlightToolContext) -> str:
        entity_type = parameters.get("entity_type", "task")
        query = parameters.get("query", "")
        status = parameters.get("status")
        priority = parameters.get("priority")
        project_id = parameters.get("project_id")
        limit = min(parameters.get("limit", 10), 20)

        if entity_type == "task":
            return await self._search_tasks(query, status, priority, project_id, limit, context)
        elif entity_type == "project":
            return await self._search_projects(query, status, limit, context)
        elif entity_type == "agent":
            return await self._search_agents(query, status, limit, context)
        else:
            return f"Unbekannter Entity-Typ: {entity_type}"

    async def _search_tasks(
        self, query: str, status: str | None, priority: str | None,
        project_id: str | None, limit: int, context: SpotlightToolContext
    ) -> str:
        async with context.session_factory() as session:
            stmt = select(Task)
            if query:
                pattern = f"%{query}%"
                stmt = stmt.where(Task.title.ilike(pattern) | Task.description.ilike(pattern))
            if status:
                stmt = stmt.where(Task.status == status)
            if priority:
                stmt = stmt.where(Task.priority == priority)
            if project_id:
                stmt = stmt.where(Task.project_id == project_id)

            stmt = stmt.order_by(Task.updated_at.desc()).limit(limit)
            result = await session.execute(stmt)
            tasks = result.scalars().all()

        if not tasks:
            filters = []
            if query:
                filters.append(f"Suche: '{query}'")
            if status:
                filters.append(f"Status: {status}")
            if priority:
                filters.append(f"Prioritaet: {priority}")
            return f"Keine Tasks gefunden. Filter: {', '.join(filters) or 'keine'}"

        lines = [f"## {len(tasks)} Tasks gefunden\n"]
        for t in tasks:
            prio = f"[{t.priority}] " if t.priority else ""
            lines.append(f"- **{t.title}** ({t.status}) {prio}— ID: {t.id}")
        return "\n".join(lines)

    async def _search_projects(
        self, query: str, status: str | None, limit: int, context: SpotlightToolContext
    ) -> str:
        async with context.session_factory() as session:
            stmt = select(Project)
            if query:
                pattern = f"%{query}%"
                stmt = stmt.where(Project.title.ilike(pattern) | Project.description.ilike(pattern))
            if status:
                stmt = stmt.where(Project.status == status)

            stmt = stmt.order_by(Project.updated_at.desc()).limit(limit)
            result = await session.execute(stmt)
            projects = result.scalars().all()

        if not projects:
            return f"Keine Projekte gefunden{f' fuer \"{query}\"' if query else ''}."

        lines = [f"## {len(projects)} Projekte gefunden\n"]
        for p in projects:
            phase = f" — Phase: {p.phase}" if p.phase else ""
            lines.append(f"- **{p.title}** ({p.status}){phase} — ID: {p.id}")
        return "\n".join(lines)

    async def _search_agents(
        self, query: str, status: str | None, limit: int, context: SpotlightToolContext
    ) -> str:
        async with context.session_factory() as session:
            # Search agent types
            stmt = select(AgentType)
            if query:
                pattern = f"%{query}%"
                stmt = stmt.where(AgentType.name.ilike(pattern) | AgentType.description.ilike(pattern))
            result = await session.execute(stmt)
            types = result.scalars().all()

            # Search running instances if status filter
            instances = []
            if status:
                inst_stmt = select(AgentInstance).where(AgentInstance.status == status).limit(limit)
                inst_result = await session.execute(inst_stmt)
                instances = inst_result.scalars().all()

        lines = []
        if types:
            lines.append(f"## {len(types)} Agent-Typen\n")
            for at in types:
                lines.append(f"- **{at.name}**: {at.description or 'Keine Beschreibung'} — ID: {at.id}")

        if instances:
            lines.append(f"\n## {len(instances)} Agent-Instanzen (Status: {status})\n")
            for inst in instances:
                lines.append(f"- Instance {inst.id[:8]}... ({inst.status}) — Typ: {inst.agent_type_id}")

        return "\n".join(lines) if lines else "Keine Agenten gefunden."
