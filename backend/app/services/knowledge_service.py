"""Knowledge service — full RAG pipeline: ingest, search, context provision.

Orchestrates document parsing, chunking, embedding, and semantic search.
"""

import json
import logging
import os
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.models.knowledge import KnowledgeChunk, KnowledgeDocument
from app.services.chunker import chunk_text
from app.services.document_parser import parse_document
from app.services.embedding_service import (
    cosine_similarity,
    deserialize_embedding,
    embed_query,
    embed_texts,
    serialize_embedding,
)

logger = logging.getLogger(__name__)


# ── Ingest Pipeline ────────────────────────────────────────────


async def ingest_document(
    doc_id: str,
    file_path: str,
    filename: str,
    file_type: str,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Full ingestion pipeline: parse → chunk → embed → store.

    Runs as a background task. Updates document status when done.
    """
    try:
        # 1. Read file
        with open(file_path, "rb") as f:
            content = f.read()

        # 2. Parse document
        text, metadata = parse_document(content, file_type)

        if not text.strip():
            await _update_doc_status(
                doc_id, "error", "Kein Text extrahiert.", session_factory
            )
            return

        # 3. Chunk
        chunks = chunk_text(text, doc_type=file_type)

        if not chunks:
            await _update_doc_status(
                doc_id, "error", "Keine Chunks erzeugt.", session_factory
            )
            return

        # 4. Embed (batch)
        chunk_texts = [c.content for c in chunks]
        embeddings = await embed_texts(chunk_texts, input_type="document")

        # 5. Store chunks in DB
        async with session_factory() as session:
            for i, chunk in enumerate(chunks):
                emb = embeddings[i] if i < len(embeddings) else None

                db_chunk = KnowledgeChunk(
                    id=chunk.id,
                    document_id=doc_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    embedding=serialize_embedding(emb) if emb else None,
                    start_index=chunk.start_index,
                    end_index=chunk.end_index,
                    metadata_json=json.dumps(chunk.metadata) if chunk.metadata else None,
                )
                session.add(db_chunk)

            # 6. Update document status
            doc = await session.get(KnowledgeDocument, doc_id)
            if doc:
                doc.status = "ready"
                doc.total_chunks = len(chunks)
                doc.character_count = metadata.get("character_count", 0)
                doc.word_count = metadata.get("word_count", 0)
                doc.error_message = None

            await session.commit()

        logger.info(
            f"Document {doc_id} ingested: {len(chunks)} chunks, "
            f"{metadata.get('word_count', 0)} words"
        )

    except Exception as e:
        logger.error(f"Ingestion failed for {doc_id}: {e}")
        await _update_doc_status(
            doc_id, "error", f"Verarbeitung fehlgeschlagen: {str(e)}", session_factory
        )


async def _update_doc_status(
    doc_id: str,
    status: str,
    error_message: Optional[str],
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Update document status and error message."""
    async with session_factory() as session:
        doc = await session.get(KnowledgeDocument, doc_id)
        if doc:
            doc.status = status
            doc.error_message = error_message
            await session.commit()


# ── Search ─────────────────────────────────────────────────────


async def search(
    query: str,
    user_id: str,
    session_factory: async_sessionmaker[AsyncSession],
    project_id: Optional[str] = None,
    top_k: int = 5,
    score_threshold: float = 0.3,
) -> list[dict]:
    """Semantic search over the knowledge base.

    Args:
        query: Natural language search query.
        user_id: Filter to this user's documents.
        session_factory: DB session factory.
        project_id: If set, include project-specific + global documents.
                    If None, search only global documents.
        top_k: Number of results to return.
        score_threshold: Minimum cosine similarity score.

    Returns:
        List of dicts: {chunk_content, document_title, document_id, score, chunk_index}
    """
    # 1. Embed query
    query_embedding = await embed_query(query)

    if not query_embedding:
        # Fallback: text search without embeddings
        return await _text_search(query, user_id, session_factory, project_id, top_k)

    # 2. Load relevant chunks with embeddings
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

        # Scope: global + optional project
        if project_id:
            stmt = stmt.where(
                (KnowledgeDocument.project_id.is_(None))
                | (KnowledgeDocument.project_id == project_id)
            )
        else:
            stmt = stmt.where(KnowledgeDocument.project_id.is_(None))

        result = await session.execute(stmt)
        chunks = result.scalars().all()

        if not chunks:
            return []

        # 3. Compute similarities
        scored: list[tuple[KnowledgeChunk, float]] = []
        for chunk in chunks:
            if not chunk.embedding:
                continue
            emb = deserialize_embedding(chunk.embedding)
            score = cosine_similarity(query_embedding, emb)
            if score >= score_threshold:
                scored.append((chunk, score))

        # 4. Sort and return top-K
        scored.sort(key=lambda x: x[1], reverse=True)
        top_results = scored[:top_k]

        # 5. Fetch document titles
        doc_ids = {c.document_id for c, _ in top_results}
        docs_stmt = select(KnowledgeDocument).where(KnowledgeDocument.id.in_(doc_ids))
        docs_result = await session.execute(docs_stmt)
        doc_map = {d.id: d.title for d in docs_result.scalars().all()}

        return [
            {
                "chunk_content": chunk.content,
                "document_title": doc_map.get(chunk.document_id, "Unbekannt"),
                "document_id": chunk.document_id,
                "score": round(score, 4),
                "chunk_index": chunk.chunk_index,
            }
            for chunk, score in top_results
        ]


async def _text_search(
    query: str,
    user_id: str,
    session_factory: async_sessionmaker[AsyncSession],
    project_id: Optional[str],
    top_k: int,
) -> list[dict]:
    """Fallback: simple text-based search when embeddings unavailable."""
    async with session_factory() as session:
        stmt = (
            select(KnowledgeChunk)
            .join(KnowledgeDocument)
            .where(
                KnowledgeDocument.user_id == user_id,
                KnowledgeDocument.status == "ready",
                KnowledgeChunk.content.contains(query),
            )
        )

        if project_id:
            stmt = stmt.where(
                (KnowledgeDocument.project_id.is_(None))
                | (KnowledgeDocument.project_id == project_id)
            )
        else:
            stmt = stmt.where(KnowledgeDocument.project_id.is_(None))

        stmt = stmt.limit(top_k)
        result = await session.execute(stmt)
        chunks = result.scalars().all()

        doc_ids = {c.document_id for c in chunks}
        if doc_ids:
            docs_stmt = select(KnowledgeDocument).where(KnowledgeDocument.id.in_(doc_ids))
            docs_result = await session.execute(docs_stmt)
            doc_map = {d.id: d.title for d in docs_result.scalars().all()}
        else:
            doc_map = {}

        return [
            {
                "chunk_content": chunk.content,
                "document_title": doc_map.get(chunk.document_id, "Unbekannt"),
                "document_id": chunk.document_id,
                "score": 0.5,  # Approximate score for text match
                "chunk_index": chunk.chunk_index,
            }
            for chunk in chunks
        ]


# ── Document Management ────────────────────────────────────────


async def delete_document(
    doc_id: str,
    session_factory: async_sessionmaker[AsyncSession],
) -> bool:
    """Delete a document, its chunks, and the uploaded file.

    Returns True if document was found and deleted.
    """
    async with session_factory() as session:
        doc = await session.get(KnowledgeDocument, doc_id)
        if not doc:
            return False

        # Delete file from disk
        if doc.file_path and os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except OSError as e:
                logger.warning(f"Could not delete file {doc.file_path}: {e}")

        # Delete document (cascades to chunks)
        await session.delete(doc)
        await session.commit()

    return True


async def get_stats(
    user_id: str,
    session_factory: async_sessionmaker[AsyncSession],
) -> dict:
    """Get aggregate stats for the user's knowledge base."""
    async with session_factory() as session:
        # Total documents
        doc_count = await session.scalar(
            select(func.count(KnowledgeDocument.id)).where(
                KnowledgeDocument.user_id == user_id
            )
        )

        # Total chunks
        chunk_count = await session.scalar(
            select(func.count(KnowledgeChunk.id))
            .join(KnowledgeDocument)
            .where(KnowledgeDocument.user_id == user_id)
        )

        # Total words
        total_words = await session.scalar(
            select(func.sum(KnowledgeDocument.word_count)).where(
                KnowledgeDocument.user_id == user_id
            )
        )

        # By type
        type_stmt = (
            select(KnowledgeDocument.file_type, func.count(KnowledgeDocument.id))
            .where(KnowledgeDocument.user_id == user_id)
            .group_by(KnowledgeDocument.file_type)
        )
        type_result = await session.execute(type_stmt)
        by_type = {row[0]: row[1] for row in type_result.all()}

        # By status
        status_stmt = (
            select(KnowledgeDocument.status, func.count(KnowledgeDocument.id))
            .where(KnowledgeDocument.user_id == user_id)
            .group_by(KnowledgeDocument.status)
        )
        status_result = await session.execute(status_stmt)
        by_status = {row[0]: row[1] for row in status_result.all()}

        return {
            "total_documents": doc_count or 0,
            "total_chunks": chunk_count or 0,
            "total_words": total_words or 0,
            "by_type": by_type,
            "by_status": by_status,
        }
