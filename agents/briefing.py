from dataclasses import dataclass
from typing import Optional


@dataclass
class TaskBriefing:
    task_id: str
    task_title: str
    task_description: str
    acceptance_criteria: Optional[str] = None
    project_title: str = ""
    project_goal: str = ""
    autonomy_level: str = "needs_approval"
    additional_context: str = ""
