"""Intelligent context selection — multi-query extraction, scoring, deduplication, token budgeting.

Analyzes a TaskBriefing to generate targeted search queries, selects the most
relevant knowledge chunks, and formats them into a compact context string that
fits within a configurable token budget.

Design principle: Minimize token count, maximize relevant context.
"""

import logging
import math
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Optional

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.models.knowledge import KnowledgeChunk, KnowledgeDocument
from app.services.embedding_service import (
    cosine_similarity,
    deserialize_embedding,
    embed_texts,
)

logger = logging.getLogger(__name__)


# ── Constants ─────────────────────────────────────────────────

MAX_QUERIES = 6
DEFAULT_SCORE_THRESHOLD = 0.35
MERGE_MAX_CHARS = 800
CHARS_PER_TOKEN = 4  # Standard heuristic for Western languages
HEADER_TOKEN_OVERHEAD = 20  # Tokens for markdown headers per chunk
FRESHNESS_HALF_LIFE_DAYS = 30
FRESHNESS_DECAY = 0.693 / FRESHNESS_HALF_LIFE_DAYS  # ln(2) / half_life

# Composite score weights
W_SEMANTIC = 0.70
W_PROJECT = 0.15
W_FRESHNESS = 0.15


# ── Return Types ──────────────────────────────────────────────


@dataclass
class ContextResult:
    """Result of intelligent context selection."""

    context_text: str = ""
    token_estimate: int = 0
    chunks_selected: int = 0
    chunks_evaluated: int = 0
    queries_used: list[str] = field(default_factory=list)
    duration_ms: int = 0


@dataclass
class _ScoredChunk:
    """Internal: a chunk with its computed scores."""

    chunk_id: str
    document_id: str
    document_title: str
    project_id: Optional[str]
    chunk_index: int
    content: str
    start_index: int
    end_index: int
    embedding: list[float]
    doc_updated_at: datetime
    semantic_score: float = 0.0
    final_score: float = 0.0


# ── Multi-Query Extraction ────────────────────────────────────

# Regex: sequences of 2+ capitalized words (German/English noun phrases)
_NP_PATTERN = re.compile(
    r"(?:[A-Z\u00c4\u00d6\u00dc][a-z\u00e4\u00f6\u00fc\u00df]+"
    r"(?:[-][A-Z\u00c4\u00d6\u00dc]?[a-z\u00e4\u00f6\u00fc\u00df]+)*"
    r"(?:\s+[A-Z\u00c4\u00d6\u00dc][a-z\u00e4\u00f6\u00fc\u00df]+"
    r"(?:[-][A-Z\u00c4\u00d6\u00dc]?[a-z\u00e4\u00f6\u00fc\u00df]+)*)+)"
)

# Regex: quoted terms (straight, curly, German-style quotes)
_QUOTED_PATTERN = re.compile(
    r'"([^"]+)"|\'([^\']+)\'|\u201e([^\u201c]+)\u201c'
)

# Common stop words that start capitalized but aren't meaningful noun phrases
_STOP_STARTS = frozenset({
    "Die", "Der", "Das", "Ein", "Eine", "Und", "Oder", "Aber", "Wenn",
    "Dann", "Auch", "Noch", "Nur", "Alle", "Jede", "Weil", "Dass",
    "The", "And", "For", "With", "From", "Into", "About", "This", "That",
})


def extract_queries(
    task_title: str,
    task_description: str = "",
    acceptance_criteria: Optional[str] = None,
    project_goal: str = "",
) -> list[str]:
    """Extract targeted search queries from task fields using NLP heuristics.

    No LLM calls — uses regex-based noun-phrase extraction and field splitting.
    Returns 1–6 deduplicated queries ordered by priority.
    """
    queries: list[str] = []

    # 1. Direct field queries (highest signal)
    if task_title:
        queries.append(task_title.strip())

    if acceptance_criteria:
        # Split criteria into individual lines (often bullet points)
        criteria_lines = [
            line.strip().lstrip("-*\u2022 ")
            for line in acceptance_criteria.split("\n")
            if line.strip() and len(line.strip()) > 10
        ]
        for line in criteria_lines[:2]:
            queries.append(line[:200])

    if task_description:
        desc = task_description.strip()
        # First sentence or first 200 chars
        dot_pos = desc.find(". ")
        end = min(dot_pos + 1 if dot_pos > 0 else len(desc), 200)
        queries.append(desc[:end].strip())

    if project_goal:
        queries.append(project_goal.strip()[:200])

    # 2. Extract quoted terms from combined text
    combined = " ".join(
        filter(None, [task_title, task_description, acceptance_criteria, project_goal])
    )

    for match in _QUOTED_PATTERN.finditer(combined):
        term = match.group(1) or match.group(2) or match.group(3)
        if term and len(term) > 3:
            queries.append(term)

    # 3. Extract multi-word noun phrases
    for match in _NP_PATTERN.finditer(combined):
        phrase = match.group(0)
        words = phrase.split()
        if len(words) >= 2 and words[0] not in _STOP_STARTS:
            queries.append(phrase)

    # 4. Deduplicate: remove queries that are substrings of others
    unique: list[str] = []
    lower_set: set[str] = set()
    for q in queries:
        q_lower = q.lower().strip()
        if not q_lower or q_lower in lower_set:
            continue
        is_substring = any(
            q_lower != other.lower() and q_lower in other.lower()
            for other in queries
        )
        if not is_substring:
            unique.append(q)
            lower_set.add(q_lower)

    return unique[:MAX_QUERIES]


# ── Core Selection ────────────────────────────────────────────


async def select_context(
    task_title: str,
    task_description: str,
    acceptance_criteria: Optional[str],
    project_id: str,
    project_goal: str,
    user_id: str,
    session_factory: async_sessionmaker[AsyncSession],
    token_budget: int = 2000,
) -> ContextResult:
    """Select the most relevant knowledge chunks for an agent's task.

    Pipeline: extract queries -> batch embed -> load chunks -> score -> dedup -> budget -> format.

    Args:
        task_title: Title of the task.
        task_description: Description of the task.
        acceptance_criteria: Acceptance criteria (may be None).
        project_id: Project ID for scope filtering.
        project_goal: Project goal text.
        user_id: User ID for document ownership.
        session_factory: Async DB session factory.
        token_budget: Maximum tokens for the context string.

    Returns:
        ContextResult with formatted context and metadata.
    """
    start_time = time.time()

    # 1. Generate queries
    queries = extract_queries(
        task_title=task_title,
        task_description=task_description,
        acceptance_criteria=acceptance_criteria,
        project_goal=project_goal,
    )

    if not queries:
        return ContextResult(queries_used=[], duration_ms=0)

    logger.debug(f"Context selection: {len(queries)} queries generated: {queries}")

    # 2. Batch-embed all queries at once
    query_embeddings = await embed_texts(queries, input_type="query")

    valid_embeddings = [
        (i, emb) for i, emb in enumerate(query_embeddings) if emb is not None
    ]
    if not valid_embeddings:
        logger.warning("Context selection: no valid query embeddings")
        return ContextResult(
            queries_used=queries,
            duration_ms=int((time.time() - start_time) * 1000),
        )

    # 3. Load candidate chunks from DB
    candidates = await _load_candidates(user_id, project_id, session_factory)

    if not candidates:
        return ContextResult(
            queries_used=queries,
            duration_ms=int((time.time() - start_time) * 1000),
        )

    # 4. Multi-query scoring: MAX cosine similarity across all queries
    now = datetime.now(UTC)
    for chunk in candidates:
        max_sim = 0.0
        for _, q_emb in valid_embeddings:
            sim = cosine_similarity(q_emb, chunk.embedding)
            if sim > max_sim:
                max_sim = sim
        chunk.semantic_score = max_sim

        # Project affinity: 1.0 for project docs, 0.5 for global
        project_affinity = 1.0 if chunk.project_id == project_id else 0.5

        # Freshness: exponential decay with 30-day half-life
        days_old = max((now - chunk.doc_updated_at).total_seconds() / 86400, 0)
        freshness = math.exp(-FRESHNESS_DECAY * days_old)

        chunk.final_score = (
            W_SEMANTIC * max_sim
            + W_PROJECT * project_affinity
            + W_FRESHNESS * freshness
        )

    # 5. Filter by threshold
    scored = [c for c in candidates if c.final_score >= DEFAULT_SCORE_THRESHOLD]
    scored.sort(key=lambda c: c.final_score, reverse=True)

    if not scored:
        return ContextResult(
            queries_used=queries,
            chunks_evaluated=len(candidates),
            duration_ms=int((time.time() - start_time) * 1000),
        )

    # 6. Deduplicate overlapping/adjacent chunks
    deduped = _deduplicate_chunks(scored)

    # 7. Fill token budget
    selected = _fill_budget(deduped, token_budget)

    # 8. Format context
    context_text = _format_context(selected)
    token_estimate = _estimate_tokens(context_text)

    duration_ms = int((time.time() - start_time) * 1000)
    logger.info(
        f"Context selection: {len(selected)}/{len(candidates)} chunks, "
        f"~{token_estimate} tokens, {duration_ms}ms"
    )

    return ContextResult(
        context_text=context_text,
        token_estimate=token_estimate,
        chunks_selected=len(selected),
        chunks_evaluated=len(candidates),
        queries_used=queries,
        duration_ms=duration_ms,
    )


# ── DB: Load Candidate Chunks ────────────────────────────────


async def _load_candidates(
    user_id: str,
    project_id: str,
    session_factory: async_sessionmaker[AsyncSession],
) -> list[_ScoredChunk]:
    """Load all embeddable chunks for the user's scope (global + project)."""
    async with session_factory() as session:
        stmt = (
            select(KnowledgeChunk)
            .join(KnowledgeDocument)
            .where(
                KnowledgeDocument.user_id == user_id,
                KnowledgeDocument.status == "ready",
                KnowledgeChunk.embedding.isnot(None),
            )
        )

        # Scope: global documents + project-specific documents
        if project_id:
            stmt = stmt.where(
                (KnowledgeDocument.project_id.is_(None))
                | (KnowledgeDocument.project_id == project_id)
            )
        else:
            stmt = stmt.where(KnowledgeDocument.project_id.is_(None))

        # Eager-load document for metadata
        stmt = stmt.options(selectinload(KnowledgeChunk.document))

        result = await session.execute(stmt)
        chunks = result.scalars().all()

        candidates = []
        for chunk in chunks:
            if not chunk.embedding:
                continue
            try:
                embedding = deserialize_embedding(chunk.embedding)
            except Exception:
                continue

            candidates.append(
                _ScoredChunk(
                    chunk_id=chunk.id,
                    document_id=chunk.document_id,
                    document_title=chunk.document.title if chunk.document else "Unbekannt",
                    project_id=chunk.document.project_id if chunk.document else None,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    start_index=chunk.start_index,
                    end_index=chunk.end_index,
                    embedding=embedding,
                    doc_updated_at=chunk.document.updated_at if chunk.document else now_utc(),
                )
            )

        return candidates


def now_utc() -> datetime:
    """Helper for default datetime."""
    return datetime.now(UTC)


# ── Deduplication ─────────────────────────────────────────────


def _deduplicate_chunks(scored: list[_ScoredChunk]) -> list[_ScoredChunk]:
    """Remove overlapping and merge adjacent chunks from the same document.

    - Overlapping ranges (same doc, overlapping start_index/end_index): keep higher score
    - Adjacent chunks (same doc, chunk_index +-1): merge if combined < 800 chars
    """
    if not scored:
        return scored

    # Group by document_id
    by_doc: dict[str, list[_ScoredChunk]] = {}
    for chunk in scored:
        by_doc.setdefault(chunk.document_id, []).append(chunk)

    result: list[_ScoredChunk] = []

    for doc_id, doc_chunks in by_doc.items():
        # Sort by chunk_index within each document
        doc_chunks.sort(key=lambda c: c.chunk_index)

        # Mark chunks to skip (absorbed by merge)
        skip: set[str] = set()

        for i, chunk in enumerate(doc_chunks):
            if chunk.chunk_id in skip:
                continue

            # Check overlap with remaining chunks in same doc
            for j in range(i + 1, len(doc_chunks)):
                other = doc_chunks[j]
                if other.chunk_id in skip:
                    continue

                # Overlapping ranges?
                if (chunk.start_index < other.end_index and other.start_index < chunk.end_index):
                    # Keep higher scored, skip lower
                    if chunk.final_score >= other.final_score:
                        skip.add(other.chunk_id)
                    else:
                        skip.add(chunk.chunk_id)
                        break

                # Adjacent chunks? (index diff == 1)
                elif abs(chunk.chunk_index - other.chunk_index) == 1:
                    combined_len = len(chunk.content) + len(other.content)
                    if combined_len <= MERGE_MAX_CHARS:
                        # Merge: combine content, keep higher score
                        if chunk.chunk_index < other.chunk_index:
                            merged_content = chunk.content + "\n" + other.content
                        else:
                            merged_content = other.content + "\n" + chunk.content
                        chunk.content = merged_content
                        chunk.end_index = max(chunk.end_index, other.end_index)
                        chunk.start_index = min(chunk.start_index, other.start_index)
                        chunk.final_score = max(chunk.final_score, other.final_score)
                        skip.add(other.chunk_id)

            if chunk.chunk_id not in skip:
                result.append(chunk)

    # Re-sort by final_score
    result.sort(key=lambda c: c.final_score, reverse=True)
    return result


# ── Token Budget ──────────────────────────────────────────────


def _estimate_tokens(text: str) -> int:
    """Estimate token count using char/4 heuristic."""
    return len(text) // CHARS_PER_TOKEN


def _truncate_at_sentence(text: str, max_chars: int) -> str:
    """Truncate text at the last sentence boundary within max_chars."""
    if len(text) <= max_chars:
        return text

    truncated = text[:max_chars]
    # Find last sentence boundary
    for sep in [". ", ".\n", "! ", "? ", ".\t"]:
        last_sep = truncated.rfind(sep)
        if last_sep > max_chars * 0.5:  # Don't cut too early
            return truncated[: last_sep + 1]

    # Fallback: cut at last space
    last_space = truncated.rfind(" ")
    if last_space > max_chars * 0.5:
        return truncated[:last_space] + "..."

    return truncated + "..."


def _fill_budget(
    ranked: list[_ScoredChunk], token_budget: int
) -> list[_ScoredChunk]:
    """Select chunks in score order until the token budget is filled."""
    selected: list[_ScoredChunk] = []
    used_tokens = 0

    for chunk in ranked:
        content_tokens = _estimate_tokens(chunk.content)
        total_needed = content_tokens + HEADER_TOKEN_OVERHEAD

        if used_tokens + total_needed <= token_budget:
            selected.append(chunk)
            used_tokens += total_needed
        else:
            # Try to fit a truncated version
            remaining_budget = token_budget - used_tokens - HEADER_TOKEN_OVERHEAD
            remaining_chars = remaining_budget * CHARS_PER_TOKEN

            if remaining_chars >= 100 * CHARS_PER_TOKEN:  # At least 100 tokens worth
                truncated = _truncate_at_sentence(chunk.content, remaining_chars)
                if len(truncated) > 50:
                    chunk.content = truncated
                    selected.append(chunk)
                    used_tokens += _estimate_tokens(truncated) + HEADER_TOKEN_OVERHEAD
            break  # Budget exhausted

    return selected


# ── Formatting ────────────────────────────────────────────────


def _format_context(selected: list[_ScoredChunk]) -> str:
    """Format selected chunks as compact markdown context."""
    if not selected:
        return ""

    parts = ["## Relevanter Kontext aus der Wissensbasis\n"]

    for chunk in selected:
        scope_label = "Projektdokument" if chunk.project_id else "Globales Dokument"
        header = f"### {scope_label}: {chunk.document_title}"
        parts.append(f"{header}\n{chunk.content}\n")

    return "\n".join(parts)
