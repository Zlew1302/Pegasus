from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class AgentType(Base):
    __tablename__ = "agent_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar: Mapped[Optional[str]] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    capabilities: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    tools: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    system_prompt: Mapped[Optional[str]] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(100), default="claude-sonnet-4-20250514")
    temperature: Mapped[float] = mapped_column(Numeric, default=0.3)
    max_tokens: Mapped[int] = mapped_column(Integer, default=4096)
    max_concurrent_instances: Mapped[int] = mapped_column(Integer, default=5)
    trust_level: Mapped[str] = mapped_column(String(20), default="propose")
    context_scope: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    is_custom: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AgentInstance(Base):
    __tablename__ = "agent_instances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    agent_type_id: Mapped[str] = mapped_column(
        ForeignKey("agent_types.id"), nullable=False
    )
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="initializing")
    current_step: Mapped[Optional[str]] = mapped_column(String(200))
    total_steps: Mapped[Optional[int]] = mapped_column(Integer)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    thought_log: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    parent_instance_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    total_cost_cents: Mapped[int] = mapped_column(Integer, default=0)
