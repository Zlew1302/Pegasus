"""McpServer model — tracks registered MCP server integrations."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class McpServer(Base):
    __tablename__ = "mcp_servers"
    __table_args__ = (
        Index("ix_mcp_servers_slug", "slug", unique=True),
        Index("ix_mcp_servers_is_connected", "is_connected"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    server_url: Mapped[str] = mapped_column(String(500), nullable=False)
    auth_type: Mapped[str] = mapped_column(
        String(20), default="none"
    )  # none | bearer | api_key
    auth_token_encrypted: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(50), default="plug")
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    available_tools: Mapped[str | None] = mapped_column(Text)  # JSON array
    last_health_check: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
