from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so they register with Base.metadata
from app.models.project import Project  # noqa: E402, F401
from app.models.task import Task, TaskDependency, TaskHistory  # noqa: E402, F401
from app.models.agent import AgentType, AgentInstance  # noqa: E402, F401
from app.models.output import TaskOutput  # noqa: E402, F401
from app.models.approval import Approval  # noqa: E402, F401
from app.models.execution import ExecutionStep  # noqa: E402, F401
from app.models.notification import Notification  # noqa: E402, F401
from app.models.user import UserProfile, UserSetting, UserTodo  # noqa: E402, F401
from app.models.team import Team, TeamMember  # noqa: E402, F401
from app.models.budget import ProjectBudget, ApiKey  # noqa: E402, F401
from app.models.comment import Comment  # noqa: E402, F401
from app.models.saved_view import SavedView  # noqa: E402, F401
from app.models.document import Document, Block  # noqa: E402, F401
from app.models.knowledge import KnowledgeDocument, KnowledgeChunk  # noqa: E402, F401
from app.models.tracks import TrackPoint, EntityNode, EntityRelationship, WorkflowPattern  # noqa: E402, F401
from app.models.attachment import TaskAttachment  # noqa: E402, F401
from app.models.time_entry import TimeEntry  # noqa: E402, F401
from app.models.task_template import TaskTemplate  # noqa: E402, F401
from app.models.webhook import Webhook, WebhookDelivery  # noqa: E402, F401
from app.models.planning_session import PlanningSession  # noqa: E402, F401
from app.models.mcp_server import McpServer  # noqa: E402, F401
