"""Spotlight-specific tools for the AI command palette."""

from agents.tools.spotlight.context import SpotlightToolContext
from agents.tools.spotlight.navigate import NavigateTool
from agents.tools.spotlight.search_data import SearchDataTool
from agents.tools.spotlight.query_stats import QueryStatsTool
from agents.tools.spotlight.crud import CreateProjectTool, CreateTaskTool, UpdateTaskTool
from agents.tools.spotlight.spawn_agent import SpawnAgentTool
from agents.tools.spotlight.knowledge import SpotlightKnowledgeSearchTool

SPOTLIGHT_TOOLS = [
    NavigateTool(),
    SearchDataTool(),
    QueryStatsTool(),
    CreateProjectTool(),
    CreateTaskTool(),
    UpdateTaskTool(),
    SpawnAgentTool(),
    SpotlightKnowledgeSearchTool(),
]

__all__ = [
    "SpotlightToolContext",
    "SPOTLIGHT_TOOLS",
    "NavigateTool",
    "SearchDataTool",
    "QueryStatsTool",
    "CreateProjectTool",
    "CreateTaskTool",
    "UpdateTaskTool",
    "SpawnAgentTool",
    "SpotlightKnowledgeSearchTool",
]
