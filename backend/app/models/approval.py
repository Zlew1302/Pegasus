from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    agent_instance_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("agent_instances.id")
    )
    requested_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    type: Mapped[str] = mapped_column(String(30))  # output_review, task_creation, etc.
    status: Mapped[str] = mapped_column(String(20), default="pending")
    description: Mapped[Optional[str]] = mapped_column(Text)
    options: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    reviewer_id: Mapped[Optional[str]] = mapped_column(String(36))
    reviewer_comment: Mapped[Optional[str]] = mapped_column(Text)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
