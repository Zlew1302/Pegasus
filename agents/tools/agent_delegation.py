"""Tool for delegating work to sub-agents."""

import asyncio
from datetime import datetime, UTC
from typing import Any
from uuid import uuid4

from sqlalchemy import select

from agents.tools.base import BaseTool, ToolContext
from app.models.agent import AgentInstance, AgentType
from app.models.task import Task


class DelegateToAgentTool(BaseTool):
    name = "delegate_to_agent"
    description = (
        "Delegiert eine Teilaufgabe an einen anderen Agent. "
        "Erstellt einen Subtask und spawnt den angegebenen Agent-Typ. "
        "Kann optional auf das Ergebnis warten."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "agent_type_id": {
                    "type": "string",
                    "description": "ID des Agent-Typs (z.B. 'agent-research-001')",
                },
                "sub_task_title": {
                    "type": "string",
                    "description": "Titel der Teilaufgabe",
                },
                "sub_task_description": {
                    "type": "string",
                    "description": "Beschreibung der Teilaufgabe",
                },
                "wait_for_result": {
                    "type": "boolean",
                    "description": "Auf Ergebnis warten (max 5 Minuten)",
                    "default": False,
                },
            },
            "required": ["agent_type_id", "sub_task_title"],
        }

    async def execute(self, parameters: dict[str, Any], context: ToolContext) -> str:
        agent_type_id = parameters.get("agent_type_id")
        title = parameters.get("sub_task_title")
        description = parameters.get("sub_task_description", "")
        wait = parameters.get("wait_for_result", False)

        if not agent_type_id or not title:
            return "Fehler: agent_type_id und sub_task_title sind erforderlich."

        async with context.session_factory() as session:
            # Verify agent type exists
            at_result = await session.execute(
                select(AgentType).where(AgentType.id == agent_type_id)
            )
            agent_type = at_result.scalar_one_or_none()
            if not agent_type:
                return f"Fehler: Agent-Typ '{agent_type_id}' nicht gefunden."

            # Get parent task for project_id
            parent_task = await session.get(Task, context.briefing.task_id)
            if not parent_task:
                return "Fehler: Parent-Task nicht gefunden."

            # Create subtask
            subtask_id = str(uuid4())
            subtask = Task(
                id=subtask_id,
                project_id=parent_task.project_id,
                parent_task_id=context.briefing.task_id,
                title=title,
                description=description,
                status="in_progress",
                priority=parent_task.priority or "medium",
                sort_order=0,
                autonomy_level=parent_task.autonomy_level,
                assignee_agent_type_id=agent_type_id,
            )
            session.add(subtask)

            # Create agent instance
            instance_id = str(uuid4())
            instance = AgentInstance(
                id=instance_id,
                agent_type_id=agent_type_id,
                task_id=subtask_id,
                status="initializing",
                parent_instance_id=context.instance_id,
                started_at=datetime.now(UTC),
            )
            session.add(instance)
            await session.commit()

        # Emit SSE event about sub-agent
        await context.sse_manager.emit(
            context.instance_id,
            type("SSEEvent", (), {
                "event": "sub_agent_spawned",
                "data": {
                    "sub_instance_id": instance_id,
                    "agent_type_id": agent_type_id,
                    "agent_type_name": agent_type.name,
                    "sub_task_title": title,
                },
            })(),
        )

        # Launch the sub-agent
        from app.services.agent_service import start_agent
        task = asyncio.create_task(start_agent(instance_id))

        if not wait:
            return (
                f"Sub-Agent '{agent_type.name}' gestartet fuer Aufgabe '{title}' "
                f"(Instance: {instance_id}). Laeuft im Hintergrund."
            )

        # Wait for completion (max 5 minutes)
        timeout = 300
        poll_interval = 5
        elapsed = 0

        while elapsed < timeout:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            async with context.session_factory() as session:
                result = await session.execute(
                    select(AgentInstance).where(AgentInstance.id == instance_id)
                )
                inst = result.scalar_one_or_none()
                if inst and inst.status in ("completed", "failed", "cancelled"):
                    if inst.status == "completed":
                        # Get the output
                        from app.models.output import TaskOutput
                        out_result = await session.execute(
                            select(TaskOutput)
                            .where(TaskOutput.task_id == subtask_id)
                            .order_by(TaskOutput.version.desc())
                        )
                        output = out_result.scalar_one_or_none()
                        content = output.content[:2000] if output else "Kein Output"
                        return (
                            f"Sub-Agent '{agent_type.name}' abgeschlossen.\n\n"
                            f"Ergebnis:\n{content}"
                        )
                    else:
                        return (
                            f"Sub-Agent '{agent_type.name}' fehlgeschlagen "
                            f"(Status: {inst.status})."
                        )

        return (
            f"Timeout: Sub-Agent '{agent_type.name}' laeuft noch nach {timeout}s. "
            f"Instance-ID: {instance_id}"
        )
