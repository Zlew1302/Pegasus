"""CRUD tools — create/update projects and tasks."""

from typing import Any
from uuid import uuid4
from datetime import datetime, UTC

from sqlalchemy import select

from agents.tools.spotlight.context import SpotlightToolContext
from app.models.project import Project
from app.models.task import Task
from app.services.task_service import validate_status_transition


class CreateProjectTool:
    name = "create_project"
    description = (
        "Erstellt ein neues Projekt in Pegasus. "
        "Nutze dieses Tool wenn der User ein neues Projekt anlegen moechte."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Titel des Projekts",
                },
                "description": {
                    "type": "string",
                    "description": "Beschreibung des Projekts",
                },
                "goal": {
                    "type": "string",
                    "description": "Ziel des Projekts",
                },
            },
            "required": ["title"],
        }

    def to_anthropic_format(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema(),
        }

    async def execute(self, parameters: dict[str, Any], context: SpotlightToolContext) -> str:
        title = parameters.get("title")
        if not title:
            return "Fehler: Titel ist erforderlich."

        project_id = str(uuid4())
        async with context.session_factory() as session:
            project = Project(
                id=project_id,
                title=title,
                description=parameters.get("description"),
                goal=parameters.get("goal"),
                status="active",
                phase="Planung",
            )
            session.add(project)
            await session.commit()

        return (
            f"ACTION:created:{project_id}|Projekt '{title}' erstellt\n"
            f"Projekt erfolgreich erstellt mit ID: {project_id}. "
            f"Du kannst es unter /projects/{project_id} oeffnen."
        )


class CreateTaskTool:
    name = "create_task"
    description = (
        "Erstellt einen neuen Task in einem Projekt. "
        "Nutze dieses Tool wenn der User einen Task erstellen moechte."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Titel des Tasks",
                },
                "description": {
                    "type": "string",
                    "description": "Beschreibung des Tasks",
                },
                "project_id": {
                    "type": "string",
                    "description": "ID des Projekts. Wenn leer, wird das aktuelle Projekt aus dem Seitenkontext verwendet.",
                },
                "priority": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low"],
                    "description": "Prioritaet des Tasks (Standard: medium)",
                },
                "status": {
                    "type": "string",
                    "enum": ["backlog", "todo"],
                    "description": "Anfangsstatus (Standard: todo)",
                },
            },
            "required": ["title"],
        }

    def to_anthropic_format(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema(),
        }

    async def execute(self, parameters: dict[str, Any], context: SpotlightToolContext) -> str:
        title = parameters.get("title")
        if not title:
            return "Fehler: Titel ist erforderlich."

        project_id = parameters.get("project_id") or context.current_entity_id
        if not project_id:
            # Try to find the first active project
            async with context.session_factory() as session:
                result = await session.execute(
                    select(Project).where(Project.status == "active").limit(1)
                )
                project = result.scalar_one_or_none()
                if project:
                    project_id = project.id
                else:
                    return "Fehler: Kein Projekt angegeben und kein aktives Projekt gefunden."

        task_id = str(uuid4())
        async with context.session_factory() as session:
            # Verify project exists
            project = await session.get(Project, project_id)
            if not project:
                return f"Fehler: Projekt '{project_id}' nicht gefunden."

            task = Task(
                id=task_id,
                project_id=project_id,
                title=title,
                description=parameters.get("description"),
                priority=parameters.get("priority", "medium"),
                status=parameters.get("status", "todo"),
                sort_order=0,
                autonomy_level="needs_approval",
            )
            session.add(task)
            await session.commit()

        return (
            f"ACTION:created:{task_id}|Task '{title}' erstellt in '{project.title}'\n"
            f"Task erfolgreich erstellt in Projekt '{project.title}'."
        )


class UpdateTaskTool:
    name = "update_task"
    description = (
        "Aktualisiert einen bestehenden Task (Status, Prioritaet, Beschreibung). "
        "Nutze dieses Tool wenn der User einen Task aendern moechte."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "ID des Tasks",
                },
                "search_term": {
                    "type": "string",
                    "description": "Suchbegriff fuer den Task (falls keine ID bekannt)",
                },
                "status": {
                    "type": "string",
                    "enum": ["backlog", "todo", "in_progress", "review", "done", "blocked"],
                    "description": "Neuer Status",
                },
                "priority": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low"],
                    "description": "Neue Prioritaet",
                },
                "description": {
                    "type": "string",
                    "description": "Neue Beschreibung",
                },
            },
            "required": [],
        }

    def to_anthropic_format(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema(),
        }

    async def execute(self, parameters: dict[str, Any], context: SpotlightToolContext) -> str:
        task_id = parameters.get("task_id")
        search_term = parameters.get("search_term")

        async with context.session_factory() as session:
            # Find the task
            task = None
            if task_id:
                task = await session.get(Task, task_id)
            elif search_term:
                result = await session.execute(
                    select(Task).where(Task.title.ilike(f"%{search_term}%")).limit(1)
                )
                task = result.scalar_one_or_none()

            if not task:
                return f"Task nicht gefunden{f' fuer \"{search_term}\"' if search_term else ''}."

            changes = []

            # Update status
            new_status = parameters.get("status")
            if new_status and new_status != task.status:
                if not validate_status_transition(task.status, new_status):
                    return (
                        f"Ungueltige Status-Transition von '{task.status}' zu '{new_status}' "
                        f"fuer Task '{task.title}'."
                    )
                old_status = task.status
                task.status = new_status
                changes.append(f"Status: {old_status} → {new_status}")

            # Update priority
            new_priority = parameters.get("priority")
            if new_priority and new_priority != task.priority:
                old_prio = task.priority
                task.priority = new_priority
                changes.append(f"Prioritaet: {old_prio} → {new_priority}")

            # Update description
            new_desc = parameters.get("description")
            if new_desc:
                task.description = new_desc
                changes.append("Beschreibung aktualisiert")

            if not changes:
                return f"Keine Aenderungen an Task '{task.title}' vorgenommen."

            task.updated_at = datetime.now(UTC)
            await session.commit()

        return (
            f"ACTION:updated:{task.id}|Task '{task.title}' aktualisiert\n"
            f"Task '{task.title}' aktualisiert: {', '.join(changes)}"
        )
