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
