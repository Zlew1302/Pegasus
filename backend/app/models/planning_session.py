"""PlanningSession model — tracks the lifecycle of a KI planning workflow."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class PlanningSession(Base):
    __tablename__ = "planning_sessions"
    __table_args__ = (
        Index("ix_planning_sessions_project_id", "project_id"),
        Index("ix_planning_sessions_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="input"
    )  # input | searching | generating | review | confirmed | cancelled
    input_mode: Mapped[str] = mapped_column(
        String(20), default="project_overview"
    )  # project_overview | custom_input

    user_notes: Mapped[Optional[str]] = mapped_column(Text)
    knowledge_doc_ids: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    web_search_topics: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    web_search_results: Mapped[Optional[str]] = mapped_column(Text)  # JSON blob
    auto_context: Mapped[bool] = mapped_column(Boolean, default=False)

    generated_plan: Mapped[Optional[str]] = mapped_column(Text)  # JSON blob
    confirmed_plan: Mapped[Optional[str]] = mapped_column(Text)  # JSON blob

    agent_instance_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
