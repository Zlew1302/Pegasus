"""Tool for managing tasks from within an agent."""

from typing import Any
from uuid import uuid4

from sqlalchemy import select

from agents.tools.base import BaseTool, ToolContext
from app.models.task import Task
from app.models.comment import Comment
from app.services.task_service import validate_status_transition


class TaskManagementTool(BaseTool):
    name = "manage_task"
    description = (
        "Verwaltet Tasks: Subtasks erstellen, Task-Status aendern, Kommentare hinzufuegen. "
        "Aktionen: create_subtask, update_task_status, add_comment."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["create_subtask", "update_task_status", "add_comment"],
                    "description": "Die auszufuehrende Aktion",
                },
                "task_id": {
                    "type": "string",
                    "description": "Task-ID (leer = aktueller Task)",
                },
                "title": {
                    "type": "string",
                    "description": "Titel fuer create_subtask",
                },
                "description": {
                    "type": "string",
                    "description": "Beschreibung fuer create_subtask",
                },
                "priority": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low"],
                    "description": "Prioritaet fuer create_subtask",
                },
                "status": {
                    "type": "string",
                    "description": "Neuer Status fuer update_task_status",
                },
                "content": {
                    "type": "string",
                    "description": "Kommentar-Text fuer add_comment",
                },
            },
            "required": ["action"],
        }

    async def execute(self, parameters: dict[str, Any], context: ToolContext) -> str:
        action = parameters.get("action")
        task_id = parameters.get("task_id") or context.briefing.task_id

        if action == "create_subtask":
            return await self._create_subtask(parameters, context, task_id)
        elif action == "update_task_status":
            return await self._update_status(parameters, context, task_id)
        elif action == "add_comment":
            return await self._add_comment(parameters, context, task_id)
        else:
            return f"Unbekannte Aktion: {action}"

    async def _create_subtask(
        self, params: dict, context: ToolContext, parent_task_id: str
    ) -> str:
        title = params.get("title")
        if not title:
            return "Fehler: Titel ist erforderlich fuer create_subtask."

        async with context.session_factory() as session:
            # Get parent task to inherit project_id
            parent = await session.get(Task, parent_task_id)
            if not parent:
                return f"Fehler: Parent-Task '{parent_task_id}' nicht gefunden."

            # Find max sort_order for subtasks
            result = await session.execute(
                select(Task)
                .where(Task.parent_task_id == parent_task_id)
                .order_by(Task.sort_order.desc())
            )
            existing = result.scalars().first()
            next_order = (existing.sort_order + 1) if existing else 0

            subtask = Task(
                id=str(uuid4()),
                project_id=parent.project_id,
                parent_task_id=parent_task_id,
                title=title,
                description=params.get("description"),
                priority=params.get("priority", "medium"),
                status="todo",
                sort_order=next_order,
                autonomy_level=parent.autonomy_level,
            )
            session.add(subtask)
            await session.commit()

            return f"Subtask erstellt: '{title}' (ID: {subtask.id}, Status: todo, Prioritaet: {subtask.priority})"

    async def _update_status(
        self, params: dict, context: ToolContext, task_id: str
    ) -> str:
        new_status = params.get("status")
        if not new_status:
            return "Fehler: Status ist erforderlich fuer update_task_status."

        async with context.session_factory() as session:
            task = await session.get(Task, task_id)
            if not task:
                return f"Fehler: Task '{task_id}' nicht gefunden."

            if not validate_status_transition(task.status, new_status):
                return (
                    f"Fehler: Ungueltige Status-Transition von '{task.status}' zu '{new_status}'. "
                    f"Erlaubte Transitionen beachten."
                )

            old_status = task.status
            task.status = new_status
            await session.commit()

            return f"Task-Status geaendert: '{task.title}' von '{old_status}' zu '{new_status}'"

    async def _add_comment(
        self, params: dict, context: ToolContext, task_id: str
    ) -> str:
        content = params.get("content")
        if not content:
            return "Fehler: Content ist erforderlich fuer add_comment."

        async with context.session_factory() as session:
            task = await session.get(Task, task_id)
            if not task:
                return f"Fehler: Task '{task_id}' nicht gefunden."

            comment = Comment(
                id=str(uuid4()),
                task_id=task_id,
                author_type="agent",
                author_name=context.briefing.agent_name or "Agent",
                content=content,
            )
            session.add(comment)
            await session.commit()

            return f"Kommentar hinzugefuegt zu Task '{task.title}'"
