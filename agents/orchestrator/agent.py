"""OrchestratorAgent — analyses tasks and delegates to specialized sub-agents."""

import json
import logging

from sqlalchemy import select

from agents.base import BaseAgent
from agents.orchestrator.prompts import (
    build_orchestrator_system_prompt,
    format_agent_types_info,
    format_mcp_tools_info,
)
from agents.tools.registry import get_tools_for_agent, TOOL_REGISTRY

logger = logging.getLogger(__name__)


class OrchestratorAgent(BaseAgent):
    """Hybrid-Orchestrator der Aufgaben analysiert und an Sub-Agenten delegiert.

    Der Orchestrator hat Zugriff auf:
    - Alle Standard-Tools (Projektkontext, Wissensbasis, Task-Management, Web-Suche)
    - DelegateToAgentTool für Sub-Agent-Delegation
    - Alle verbundenen MCP-Server-Tools (dynamisch geladen)
    """

    async def run(self) -> str:
        """Führe den Orchestrator-Workflow aus."""

        # 1. Lade alle verfügbaren Tools
        tools = await self._load_all_tools()

        # 2. Baue den System-Prompt mit Kontext
        system_prompt = await self._build_system_prompt()

        # 3. Erstelle die User-Nachricht aus dem Briefing
        user_message = self._build_user_message()

        # 4. Führe den agentic tool-use Loop aus
        logger.info(
            "OrchestratorAgent gestartet mit %d Tools für Task '%s'",
            len(tools), self.briefing.task_title,
        )

        result = await self._call_claude_with_tools(
            user_message=user_message,
            tools=tools,
            system=system_prompt,
        )

        return result

    async def _load_all_tools(self):
        """Lade Standard-Tools + MCP-Bridge-Tools."""
        from agents.tools.mcp_bridge import load_mcp_tools

        # Standard-Tools aus dem Briefing
        standard_tools = get_tools_for_agent(self.briefing.tools_json)

        # MCP-Bridge-Tools von verbundenen Servern
        mcp_tools = []
        try:
            mcp_tools = await load_mcp_tools(self.session_factory)
            if mcp_tools:
                logger.info(
                    "Orchestrator: %d MCP-Tools geladen",
                    len(mcp_tools),
                )
        except Exception as e:
            logger.warning("MCP-Tools konnten nicht geladen werden: %s", str(e))

        return standard_tools + mcp_tools

    async def _build_system_prompt(self) -> str:
        """Baue den System-Prompt mit dynamischem Kontext."""
        from app.models.agent import AgentType

        # Lade Agent-Typen-Info
        agent_types_info = ""
        try:
            async with self.session_factory() as db:
                result = await db.execute(
                    select(AgentType).where(AgentType.is_custom == False)  # noqa: E712
                )
                agent_types = list(result.scalars().all())

                types_data = []
                for at in agent_types:
                    # Orchestrator nicht in die Liste aufnehmen
                    if at.id == "agent-orchestrator-001":
                        continue
                    types_data.append({
                        "id": at.id,
                        "name": at.name,
                        "description": at.description or "",
                        "capabilities": at.capabilities or "",
                    })

                agent_types_info = format_agent_types_info(types_data)

        except Exception as e:
            logger.warning("Agent-Typen konnten nicht geladen werden: %s", str(e))

        # Lade MCP-Tools-Info
        mcp_tools_info = ""
        try:
            from agents.tools.mcp_bridge import load_mcp_tools
            mcp_tools = await load_mcp_tools(self.session_factory)
            if mcp_tools:
                tools_data = [
                    {
                        "server_name": t._server_name,
                        "tool_name": t.name,
                        "description": t.description,
                    }
                    for t in mcp_tools
                ]
                mcp_tools_info = format_mcp_tools_info(tools_data)
        except Exception as e:
            logger.warning("MCP-Tools-Info konnte nicht geladen werden: %s", str(e))

        # Projektkontext
        project_context = ""
        if self.briefing.project_title:
            project_context = f"**Projekt:** {self.briefing.project_title}"
            if self.briefing.project_goal:
                project_context += f"\n**Ziel:** {self.briefing.project_goal}"

        return build_orchestrator_system_prompt(
            agent_types_info=agent_types_info,
            mcp_tools_info=mcp_tools_info,
            project_context=project_context,
        )

    def _build_user_message(self) -> str:
        """Baue die User-Nachricht aus dem Briefing."""
        parts = []

        # Hauptanfrage (task title oder description)
        if self.briefing.task_description:
            parts.append(self.briefing.task_description)
        else:
            parts.append(self.briefing.task_title)

        # Zusätzlicher Kontext
        if self.briefing.additional_context:
            parts.append(f"\n---\n\nZusätzlicher Kontext:\n{self.briefing.additional_context}")

        # Akzeptanzkriterien
        if self.briefing.acceptance_criteria:
            parts.append(f"\n---\n\nAkzeptanzkriterien:\n{self.briefing.acceptance_criteria}")

        return "\n".join(parts)
