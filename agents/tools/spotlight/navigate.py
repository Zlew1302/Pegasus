"""Navigate tool — resolves entity references to URL paths."""

from typing import Any

from sqlalchemy import select

from agents.tools.spotlight.context import SpotlightToolContext
from app.models.project import Project
from app.models.task import Task


class NavigateTool:
    name = "navigate"
    description = (
        "Navigiert zu einer bestimmten Seite in CrewBoard. "
        "Gibt den URL-Pfad zurueck, damit der User dorthin geleitet wird. "
        "Nutze dieses Tool wenn der User eine Seite oeffnen oder zu etwas navigieren moechte."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "enum": ["dashboard", "projects", "project", "task", "workspace", "document", "board", "profile"],
                    "description": "Zieltyp der Navigation",
                },
                "entity_id": {
                    "type": "string",
                    "description": "ID der Entitaet (Projekt-ID, Task-ID, Dokument-ID). Nur noetig bei project/task/document.",
                },
                "search_term": {
                    "type": "string",
                    "description": "Suchbegriff um die Entitaet zu finden, falls keine ID bekannt.",
                },
            },
            "required": ["target"],
        }

    def to_anthropic_format(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema(),
        }

    async def execute(self, parameters: dict[str, Any], context: SpotlightToolContext) -> str:
        target = parameters.get("target", "")
        entity_id = parameters.get("entity_id")
        search_term = parameters.get("search_term")

        # Static routes
        static_routes = {
            "dashboard": "/dashboard",
            "projects": "/projects",
            "workspace": "/workspace",
            "board": "/board",
            "profile": "/profile",
        }

        if target in static_routes and not entity_id and not search_term:
            path = static_routes[target]
            return f"ACTION:navigate:{path}|Navigation zu {target.title()}"

        # Entity routes — need to resolve ID
        if target == "project":
            return await self._resolve_project(entity_id, search_term, context)
        elif target == "task":
            return await self._resolve_task(entity_id, search_term, context)
        elif target == "document":
            path = f"/workspace/{entity_id}" if entity_id else "/workspace"
            return f"ACTION:navigate:{path}|Dokument oeffnen"

        path = static_routes.get(target, "/dashboard")
        return f"ACTION:navigate:{path}|Navigation zu {target}"

    async def _resolve_project(
        self, entity_id: str | None, search_term: str | None, context: SpotlightToolContext
    ) -> str:
        async with context.session_factory() as session:
            if entity_id:
                project = await session.get(Project, entity_id)
                if project:
                    return f"ACTION:navigate:/projects/{project.id}|Projekt '{project.title}' oeffnen"
                return f"Projekt mit ID '{entity_id}' nicht gefunden."

            if search_term:
                result = await session.execute(
                    select(Project).where(Project.title.ilike(f"%{search_term}%")).limit(1)
                )
                project = result.scalar_one_or_none()
                if project:
                    return f"ACTION:navigate:/projects/{project.id}|Projekt '{project.title}' oeffnen"
                return f"Kein Projekt mit '{search_term}' im Titel gefunden."

        return "Fehler: Keine Projekt-ID oder Suchbegriff angegeben."

    async def _resolve_task(
        self, entity_id: str | None, search_term: str | None, context: SpotlightToolContext
    ) -> str:
        async with context.session_factory() as session:
            if entity_id:
                task = await session.get(Task, entity_id)
                if task:
                    return f"ACTION:navigate:/projects/{task.project_id}|Task '{task.title}' im Projekt oeffnen"
                return f"Task mit ID '{entity_id}' nicht gefunden."

            if search_term:
                result = await session.execute(
                    select(Task).where(Task.title.ilike(f"%{search_term}%")).limit(1)
                )
                task = result.scalar_one_or_none()
                if task:
                    return f"ACTION:navigate:/projects/{task.project_id}|Task '{task.title}' im Projekt oeffnen"
                return f"Kein Task mit '{search_term}' im Titel gefunden."

        return "Fehler: Keine Task-ID oder Suchbegriff angegeben."
