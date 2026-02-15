from dataclasses import dataclass
from typing import Optional


@dataclass
class TaskBriefing:
    task_id: str
    task_title: str
    task_description: str
    acceptance_criteria: Optional[str] = None
    project_id: str = ""
    project_title: str = ""
    project_goal: str = ""
    autonomy_level: str = "needs_approval"
    additional_context: str = ""
    user_id: str = "default-user"
    # Agent config from AgentType record
    agent_name: str = ""
    provider: str = "anthropic"
    provider_base_url: Optional[str] = None
    provider_api_key: Optional[str] = None
    model: str = "claude-sonnet-4-20250514"
    temperature: float = 0.3
    max_tokens: int = 4096
    system_prompt: Optional[str] = None
    tools_json: Optional[str] = None
