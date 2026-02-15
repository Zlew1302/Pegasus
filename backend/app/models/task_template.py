from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class TaskTemplate(Base):
    __tablename__ = "task_templates"
    __table_args__ = (
        Index("ix_task_templates_project_id", "project_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    assignee_agent_type_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    recurrence_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # daily, weekly, monthly
    recurrence_interval: Mapped[int] = mapped_column(Integer, default=1)
    recurrence_day: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-6 weekday, 1-31 monthday
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
