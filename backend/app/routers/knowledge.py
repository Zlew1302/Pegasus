"""Knowledge base router — upload, manage, and search documents."""

import asyncio
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select

from app.auth import get_current_user
from app.database import async_session
from app.models.knowledge import KnowledgeDocument
from app.pagination import PaginatedResponse, PaginationParams
from app.schemas.knowledge import (
    KnowledgeDocumentResponse,
    KnowledgeDocumentUpdate,
    KnowledgeSearchRequest,
    KnowledgeSearchResult,
    KnowledgeStatsResponse,
)
from app.services import knowledge_service
from app.services.document_parser import detect_file_type

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_EXTENSIONS = {
    "pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt",
    "html", "htm", "md", "markdown", "json", "txt", "csv",
    "log", "py", "js", "ts",
    "png", "jpg", "jpeg", "gif", "webp",
}


@router.post("/upload", status_code=202)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    project_id: str = Form(default=""),
    user_id: str = Depends(get_current_user),
):
    """Upload a document for processing.

    Returns 202 Accepted immediately, processing happens in background.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Kein Dateiname angegeben.")

    # Validate extension
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Dateityp '.{ext}' nicht unterstuetzt. Erlaubt: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Read content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Datei zu gross (max. 50 MB).")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Datei ist leer.")

    # Detect file type
    file_type = detect_file_type(file.filename, content)

    # Save to uploads dir
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    doc_id = str(uuid4())
    safe_filename = f"{doc_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # Determine title
    doc_title = title.strip() if title.strip() else file.filename.rsplit(".", 1)[0]

    # Create document record
    async with async_session() as session:
        doc = KnowledgeDocument(
            id=doc_id,
            user_id=user_id,
            project_id=project_id if project_id else None,
            filename=file.filename,
            file_path=file_path,
            file_type=file_type,
            file_size_bytes=len(content),
            title=doc_title,
            status="processing",
        )
        session.add(doc)
        await session.commit()

    # Start background ingestion
    asyncio.create_task(
        knowledge_service.ingest_document(
            doc_id=doc_id,
            file_path=file_path,
            filename=file.filename,
            file_type=file_type,
            session_factory=async_session,
        )
    )

    return {"id": doc_id, "status": "processing", "filename": file.filename}


@router.get("/documents", response_model=PaginatedResponse[KnowledgeDocumentResponse])
async def list_documents(
    project_id: str = "",
    status: str = "",
    user_id: str = Depends(get_current_user),
    pagination: PaginationParams = Depends(),
):
    """List all documents, optionally filtered by project_id and/or status."""
    async with async_session() as session:
        base = select(KnowledgeDocument).where(
            KnowledgeDocument.user_id == user_id
        )
        count_q = select(func.count()).where(
            KnowledgeDocument.user_id == user_id
        ).select_from(KnowledgeDocument)

        if project_id:
            base = base.where(KnowledgeDocument.project_id == project_id)
            count_q = count_q.where(KnowledgeDocument.project_id == project_id)

        if status:
            base = base.where(KnowledgeDocument.status == status)
            count_q = count_q.where(KnowledgeDocument.status == status)

        total = await session.scalar(count_q) or 0

        stmt = (
            base
            .order_by(KnowledgeDocument.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        result = await session.execute(stmt)
        docs = result.scalars().all()

        return PaginatedResponse(
            items=[KnowledgeDocumentResponse.model_validate(d) for d in docs],
            total=total,
            limit=pagination.limit,
            offset=pagination.offset,
            has_more=(pagination.offset + pagination.limit) < total,
        )


@router.get("/documents/{doc_id}", response_model=KnowledgeDocumentResponse)
async def get_document(doc_id: str):
    """Get a single document by ID."""
    async with async_session() as session:
        doc = await session.get(KnowledgeDocument, doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Dokument nicht gefunden.")
        return KnowledgeDocumentResponse.model_validate(doc)


@router.patch("/documents/{doc_id}", response_model=KnowledgeDocumentResponse)
async def update_document(doc_id: str, body: KnowledgeDocumentUpdate):
    """Update document title and/or description."""
    async with async_session() as session:
        doc = await session.get(KnowledgeDocument, doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Dokument nicht gefunden.")

        if body.title is not None:
            doc.title = body.title
        if body.description is not None:
            doc.description = body.description

        await session.commit()
        await session.refresh(doc)
        return KnowledgeDocumentResponse.model_validate(doc)


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document, its chunks, and the uploaded file."""
    deleted = await knowledge_service.delete_document(doc_id, async_session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden.")
    return {"status": "deleted", "id": doc_id}


@router.post("/search", response_model=list[KnowledgeSearchResult])
async def search_knowledge(
    body: KnowledgeSearchRequest,
    user_id: str = Depends(get_current_user),
):
    """Semantic search over the knowledge base."""
    results = await knowledge_service.search(
        query=body.query,
        user_id=user_id,
        session_factory=async_session,
        project_id=body.project_id,
        top_k=body.top_k,
    )
    return [KnowledgeSearchResult(**r) for r in results]


@router.get("/stats", response_model=KnowledgeStatsResponse)
async def get_stats(user_id: str = Depends(get_current_user)):
    """Get aggregate knowledge base statistics."""
    stats = await knowledge_service.get_stats(user_id, async_session)
    return KnowledgeStatsResponse(**stats)
