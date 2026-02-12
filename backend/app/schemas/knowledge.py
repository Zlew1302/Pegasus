"""Pydantic schemas for the knowledge / RAG system."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Response schemas ───────────────────────────────────────────


class KnowledgeDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    file_type: str
    title: str
    description: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    total_chunks: int = 0
    character_count: int = 0
    word_count: int = 0
    file_size_bytes: int = 0
    project_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Request schemas ────────────────────────────────────────────


class KnowledgeDocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    project_id: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=20)


# ── Search result ──────────────────────────────────────────────


class KnowledgeSearchResult(BaseModel):
    chunk_content: str
    document_title: str
    document_id: str
    score: float
    chunk_index: int


# ── Stats ──────────────────────────────────────────────────────


class KnowledgeStatsResponse(BaseModel):
    total_documents: int = 0
    total_chunks: int = 0
    total_words: int = 0
    by_type: dict[str, int] = {}
    by_status: dict[str, int] = {}
