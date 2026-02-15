"""Stats tool — answers aggregate questions about the system."""

from typing import Any

from sqlalchemy import select, func

from agents.tools.spotlight.context import SpotlightToolContext
from app.models.task import Task
from app.models.project import Project
from app.models.agent import AgentInstance, AgentType


class QueryStatsTool:
    name = "query_stats"
    description = (
        "Beantwortet statistische Fragen ueber Pegasus-Daten: "
        "Anzahl offener Tasks, Projektstatus, Agent-Aktivitaet, usw. "
        "Nutze dieses Tool fuer Fragen wie 'Wie viele Tasks sind offen?' oder 'Was ist der Projektstatus?'"
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "stat_type": {
                    "type": "string",
                    "enum": [
                        "task_count_by_status",
                        "task_count_by_priority",
                        "project_summary",
                        "agent_activity",
                        "overall_summary",
                    ],
                    "description": "Art der Statistik",
                },
                "project_id": {
                    "type": "string",
                    "description": "Optional: Statistik auf ein Projekt einschraenken",
                },
            },
            "required": ["stat_type"],
        }

    def to_anthropic_format(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema(),
        }

    async def execute(self, parameters: dict[str, Any], context: SpotlightToolContext) -> str:
        stat_type = parameters.get("stat_type", "overall_summary")
        project_id = parameters.get("project_id")

        if stat_type == "task_count_by_status":
            return await self._task_count_by_status(project_id, context)
        elif stat_type == "task_count_by_priority":
            return await self._task_count_by_priority(project_id, context)
        elif stat_type == "project_summary":
            return await self._project_summary(context)
        elif stat_type == "agent_activity":
            return await self._agent_activity(context)
        elif stat_type == "overall_summary":
            return await self._overall_summary(context)
        else:
            return f"Unbekannter Statistik-Typ: {stat_type}"

    async def _task_count_by_status(self, project_id: str | None, context: SpotlightToolContext) -> str:
        async with context.session_factory() as session:
            stmt = select(Task.status, func.count(Task.id)).group_by(Task.status)
            if project_id:
                stmt = stmt.where(Task.project_id == project_id)
            result = await session.execute(stmt)
            counts = result.all()

        if not counts:
            return "Keine Tasks vorhanden."

        total = sum(c for _, c in counts)
        lines = [f"## Tasks nach Status (gesamt: {total})\n"]
        status_labels = {
            "backlog": "Backlog", "todo": "Zu erledigen", "in_progress": "In Arbeit",
            "review": "Review", "done": "Erledigt", "blocked": "Blockiert",
        }
        for status, count in sorted(counts, key=lambda x: x[1], reverse=True):
            label = status_labels.get(status, status)
            lines.append(f"- {label}: **{count}**")
        return "\n".join(lines)

    async def _task_count_by_priority(self, project_id: str | None, context: SpotlightToolContext) -> str:
        async with context.session_factory() as session:
            stmt = select(Task.priority, func.count(Task.id)).group_by(Task.priority)
            if project_id:
                stmt = stmt.where(Task.project_id == project_id)
            result = await session.execute(stmt)
            counts = result.all()

        if not counts:
            return "Keine Tasks vorhanden."

        lines = ["## Tasks nach Prioritaet\n"]
        prio_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        for priority, count in sorted(counts, key=lambda x: prio_order.get(x[0] or "", 99)):
            lines.append(f"- {(priority or 'Keine').title()}: **{count}**")
        return "\n".join(lines)

    async def _project_summary(self, context: SpotlightToolContext) -> str:
        async with context.session_factory() as session:
            result = await session.execute(select(Project).order_by(Project.updated_at.desc()))
            projects = result.scalars().all()

            lines = [f"## {len(projects)} Projekte\n"]
            for p in projects:
                # Count tasks per project
                task_result = await session.execute(
                    select(func.count(Task.id)).where(Task.project_id == p.id)
                )
                task_count = task_result.scalar() or 0
                done_result = await session.execute(
                    select(func.count(Task.id)).where(Task.project_id == p.id, Task.status == "done")
                )
                done_count = done_result.scalar() or 0

                phase = f" — Phase: {p.phase}" if p.phase else ""
                progress = f" ({done_count}/{task_count} Tasks erledigt)" if task_count > 0 else ""
                lines.append(f"- **{p.title}** ({p.status}){phase}{progress}")

        return "\n".join(lines)

    async def _agent_activity(self, context: SpotlightToolContext) -> str:
        async with context.session_factory() as session:
            # Count instances by status
            result = await session.execute(
                select(AgentInstance.status, func.count(AgentInstance.id))
                .group_by(AgentInstance.status)
            )
            counts = result.all()

            # Get agent types
            types_result = await session.execute(select(AgentType))
            types = types_result.scalars().all()

        lines = ["## Agent-Aktivitaet\n"]
        lines.append(f"**{len(types)} Agent-Typen** verfuegbar\n")

        if counts:
            lines.append("### Instanzen nach Status")
            for status, count in counts:
                lines.append(f"- {status}: **{count}**")

        return "\n".join(lines)

    async def _overall_summary(self, context: SpotlightToolContext) -> str:
        async with context.session_factory() as session:
            project_count = (await session.execute(select(func.count(Project.id)))).scalar() or 0
            task_count = (await session.execute(select(func.count(Task.id)))).scalar() or 0
            open_tasks = (await session.execute(
                select(func.count(Task.id)).where(Task.status.in_(["todo", "in_progress", "review", "blocked"]))
            )).scalar() or 0
            done_tasks = (await session.execute(
                select(func.count(Task.id)).where(Task.status == "done")
            )).scalar() or 0
            running_agents = (await session.execute(
                select(func.count(AgentInstance.id)).where(AgentInstance.status == "running")
            )).scalar() or 0

        lines = [
            "## Pegasus Uebersicht\n",
            f"- **{project_count}** Projekte",
            f"- **{task_count}** Tasks gesamt ({open_tasks} offen, {done_tasks} erledigt)",
            f"- **{running_agents}** Agenten laufen gerade",
        ]
        return "\n".join(lines)
