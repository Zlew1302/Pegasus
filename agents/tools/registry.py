"""Tool registry — maps tool names to instances."""

import json

from agents.tools.base import BaseTool
from agents.tools.web_search import WebSearchTool
from agents.tools.project_context import ReadProjectContextTool
from agents.tools.task_management import TaskManagementTool
from agents.tools.agent_delegation import DelegateToAgentTool

# Global tool registry
TOOL_REGISTRY: dict[str, BaseTool] = {}


def register_tool(tool: BaseTool):
    """Register a tool in the global registry."""
    TOOL_REGISTRY[tool.name] = tool


def get_tools_for_agent(tools_json: str | None) -> list[BaseTool]:
    """Parse tools JSON from AgentType and return matching tool instances."""
    if not tools_json:
        return []
    try:
        tool_names = json.loads(tools_json)
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(tool_names, list):
        return []
    return [TOOL_REGISTRY[name] for name in tool_names if name in TOOL_REGISTRY]


# Register all built-in tools
register_tool(WebSearchTool())
register_tool(ReadProjectContextTool())
register_tool(TaskManagementTool())
register_tool(DelegateToAgentTool())
