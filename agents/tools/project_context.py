"""Tool to read project context from database."""

from typing import Any

from sqlalchemy import select, func

from agents.tools.base import BaseTool, ToolContext
from app.models.project import Project
from app.models.task import Task
from app.models.team import Team, TeamMember


class ReadProjectContextTool(BaseTool):
    name = "read_project_context"
    description = "Liest Projekt-Details, alle Tasks mit Status, und Team-Informationen aus der Datenbank."

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                    "description": "Projekt-ID (leer = aktuelles Projekt)",
                },
            },
            "required": [],
        }

    async def execute(self, parameters: dict[str, Any], context: ToolContext) -> str:
        project_id = parameters.get("project_id") or context.briefing.project_id

        if not project_id:
            return "Fehler: Keine Projekt-ID verfuegbar."

        async with context.session_factory() as session:
            # Load project
            project = await session.get(Project, project_id)
            if not project:
                return f"Projekt '{project_id}' nicht gefunden."

            # Load tasks
            result = await session.execute(
                select(Task)
                .where(Task.project_id == project_id)
                .order_by(Task.sort_order)
            )
            tasks = result.scalars().all()

            # Load team if assigned
            team_info = ""
            if project.team_id:
                team = await session.get(Team, project.team_id)
                if team:
                    members_result = await session.execute(
                        select(TeamMember).where(TeamMember.team_id == team.id)
                    )
                    members = members_result.scalars().all()
                    member_lines = []
                    for m in members:
                        role_label = f" ({m.role})" if m.role != "member" else ""
                        type_label = "Agent" if m.member_type == "agent" else "Mensch"
                        member_lines.append(f"  - {m.member_name or m.member_id} [{type_label}]{role_label}")
                    team_info = f"\n## Team: {team.name}\n" + "\n".join(member_lines)

        # Build output
        lines = [f"# Projekt: {project.title}"]

        if project.description:
            lines.append(f"\n**Beschreibung:** {project.description}")
        if project.goal:
            lines.append(f"**Ziel:** {project.goal}")
        if project.phase:
            lines.append(f"**Phase:** {project.phase}")

        lines.append(f"**Status:** {project.status}")

        # Task status summary
        status_counts: dict[str, int] = {}
        for t in tasks:
            status_counts[t.status] = status_counts.get(t.status, 0) + 1

        lines.append(f"\n## Tasks ({len(tasks)} gesamt)")
        for status, count in sorted(status_counts.items()):
            lines.append(f"  - {status}: {count}")

        # Task list
        lines.append("\n## Task-Liste")
        for t in tasks:
            priority = f"[{t.priority}]" if t.priority else ""
            assignee = " (Agent)" if t.assignee_agent_type_id else ""
            parent = f" (Subtask)" if t.parent_task_id else ""
            lines.append(f"  - [{t.status}] {priority} {t.title}{assignee}{parent}")

        if team_info:
            lines.append(team_info)

        return "\n".join(lines)
