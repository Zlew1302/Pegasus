from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class TaskOutput(Base):
    __tablename__ = "task_outputs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    created_by_type: Mapped[str] = mapped_column(String(10))  # human, agent
    created_by_id: Mapped[Optional[str]] = mapped_column(String(36))
    content_type: Mapped[str] = mapped_column(String(20), default="markdown")
    content: Mapped[Optional[str]] = mapped_column(Text)
    file_path: Mapped[Optional[str]] = mapped_column(String(500))
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    task: Mapped["Task"] = relationship(back_populates="outputs")  # noqa: F821
