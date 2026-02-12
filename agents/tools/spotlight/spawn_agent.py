"""Spawn agent tool — starts background agent tasks from Spotlight."""

import asyncio
from datetime import datetime, UTC
from typing import Any
from uuid import uuid4

from sqlalchemy import select

from agents.tools.spotlight.context import SpotlightToolContext
from app.models.agent import AgentInstance, AgentType
from app.models.task import Task
from app.models.project import Project


class SpawnAgentTool:
    name = "spawn_agent"
    description = (
        "Startet einen KI-Agenten im Hintergrund fuer eine bestimmte Aufgabe. "
        "Erstellt einen Task und weist ihn dem Agenten zu. "
        "Verfuegbare Agenten: Research-Agent (agent-research-001) fuer Recherche, "
        "Planning-Agent (agent-planning-001) fuer Aufgabenplanung. "
        "Nutze dieses Tool wenn der User eine Recherche, Analyse oder Planung starten moechte."
    )

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "agent_type_id": {
                    "type": "string",
                    "description": "ID des Agent-Typs: 'agent-research-001' oder 'agent-planning-001'",
                },
                "task_title": {
                    "type": "string",
                    "description": "Titel der Aufgabe fuer den Agenten",
                },
                "task_description": {
                    "type": "string",
                    "description": "Detaillierte Beschreibung was der Agent tun soll",
                },
                "project_id": {
                    "type": "string",
                    "description": "Projekt-ID (optional, nutzt aktuellen Kontext oder erstes aktives Projekt)",
                },
            },
            "required": ["agent_type_id", "task_title"],
        }

    def to_anthropic_format(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema(),
        }

    async def execute(self, parameters: dict[str, Any], context: SpotlightToolContext) -> str:
        agent_type_id = parameters.get("agent_type_id")
        task_title = parameters.get("task_title")
        task_description = parameters.get("task_description", "")

        if not agent_type_id or not task_title:
            return "Fehler: agent_type_id und task_title sind erforderlich."

        async with context.session_factory() as session:
            # Verify agent type
            at_result = await session.execute(
                select(AgentType).where(AgentType.id == agent_type_id)
            )
            agent_type = at_result.scalar_one_or_none()
            if not agent_type:
                return f"Fehler: Agent-Typ '{agent_type_id}' nicht gefunden."

            # Check API key
            from app.config import settings
            if not settings.ANTHROPIC_API_KEY:
                return "Fehler: Kein ANTHROPIC_API_KEY konfiguriert. Agent kann nicht gestartet werden."

            # Find project
            project_id = parameters.get("project_id") or context.current_entity_id
            if not project_id:
                # Use first active project
                proj_result = await session.execute(
                    select(Project).where(Project.status == "active").limit(1)
                )
                project = proj_result.scalar_one_or_none()
                if project:
                    project_id = project.id
                else:
                    return "Fehler: Kein Projekt gefunden. Erstelle zuerst ein Projekt."

            # Create task
            task_id = str(uuid4())
            task = Task(
                id=task_id,
                project_id=project_id,
                title=task_title,
                description=task_description,
                status="in_progress",
                priority="medium",
                sort_order=0,
                autonomy_level="needs_approval",
                assignee_agent_type_id=agent_type_id,
            )
            session.add(task)

            # Create agent instance
            instance_id = str(uuid4())
            instance = AgentInstance(
                id=instance_id,
                agent_type_id=agent_type_id,
                task_id=task_id,
                status="initializing",
                started_at=datetime.now(UTC),
            )
            session.add(instance)
            await session.commit()

        # Launch agent in background
        from app.services.agent_service import launch_agent_task
        launch_agent_task(instance_id)

        return (
            f"ACTION:spawned:{instance_id}|{agent_type.name} gestartet: '{task_title}'\n"
            f"Agent '{agent_type.name}' wurde im Hintergrund gestartet fuer die Aufgabe "
            f"'{task_title}'. Du erhaeltst eine Benachrichtigung wenn der Agent fertig ist."
        )
