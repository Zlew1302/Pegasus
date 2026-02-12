"""Reusable pagination helpers for list endpoints."""

from typing import Any, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")


class PaginationParams:
    """Dependency for pagination query parameters."""

    def __init__(
        self,
        limit: int = Query(50, ge=1, le=200, description="Max items per page"),
        offset: int = Query(0, ge=0, description="Items to skip"),
    ):
        self.limit = limit
        self.offset = offset


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response wrapper."""

    items: list[T]
    total: int
    limit: int
    offset: int
    has_more: bool
