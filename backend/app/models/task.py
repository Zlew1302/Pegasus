from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('backlog','todo','in_progress','review','done','blocked')",
            name="ck_task_status",
        ),
        CheckConstraint(
            "priority IN ('critical','high','medium','low')",
            name="ck_task_priority",
        ),
        CheckConstraint(
            "autonomy_level IN ('full_auto','needs_approval','human_only')",
            name="ck_task_autonomy",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    parent_task_id: Mapped[Optional[str]] = mapped_column(ForeignKey("tasks.id"))
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    acceptance_criteria: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="backlog")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    task_type: Mapped[Optional[str]] = mapped_column(String(50))
    template_id: Mapped[Optional[str]] = mapped_column(String(36))
    assignee_human_id: Mapped[Optional[str]] = mapped_column(String(36))
    assignee_agent_type_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("agent_types.id")
    )
    autonomy_level: Mapped[str] = mapped_column(String(20), default="needs_approval")
    estimated_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    actual_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[Optional[str]] = mapped_column(Text)  # JSON array as string
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="tasks")  # noqa: F821
    subtasks: Mapped[list["Task"]] = relationship(back_populates="parent_task")
    parent_task: Mapped[Optional["Task"]] = relationship(
        back_populates="subtasks", remote_side="Task.id"
    )
    outputs: Mapped[list["TaskOutput"]] = relationship(back_populates="task")  # noqa: F821
    history: Mapped[list["TaskHistory"]] = relationship(back_populates="task")


class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    task_id: Mapped[str] = mapped_column(
        ForeignKey("tasks.id"), primary_key=True
    )
    depends_on_task_id: Mapped[str] = mapped_column(
        ForeignKey("tasks.id"), primary_key=True
    )


class TaskHistory(Base):
    __tablename__ = "task_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    changed_by_type: Mapped[str] = mapped_column(String(10))  # human, agent, system
    changed_by_id: Mapped[Optional[str]] = mapped_column(String(36))
    field_name: Mapped[str] = mapped_column(String(50))
    old_value: Mapped[Optional[str]] = mapped_column(Text)
    new_value: Mapped[Optional[str]] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    task: Mapped["Task"] = relationship(back_populates="history")
