from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.document import Block, Document
from app.models.project import Project
from app.schemas.document import (
    BlockCreate,
    BlockResponse,
    BlockUpdate,
    BulkBlockReorder,
    DocumentCreate,
    DocumentDetailResponse,
    DocumentResponse,
    DocumentUpdate,
)

router = APIRouter(prefix="/api", tags=["documents"])


# ── Document CRUD ──────────────────────────────────────────────


@router.get(
    "/projects/{project_id}/documents",
    response_model=list[DocumentResponse],
)
async def list_documents(
    project_id: str, session: AsyncSession = Depends(get_db)
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Projekt nicht gefunden")

    result = await session.execute(
        select(
            Document,
            func.count(Block.id).label("block_count"),
        )
        .outerjoin(Block, Block.document_id == Document.id)
        .where(Document.project_id == project_id)
        .group_by(Document.id)
        .order_by(Document.is_pinned.desc(), Document.updated_at.desc())
    )
    rows = result.all()
    return [
        DocumentResponse(
            id=doc.id,
            project_id=doc.project_id,
            title=doc.title,
            icon=doc.icon,
            is_pinned=doc.is_pinned,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
            block_count=count,
        )
        for doc, count in rows
    ]


@router.post(
    "/projects/{project_id}/documents",
    response_model=DocumentDetailResponse,
    status_code=201,
)
async def create_document(
    project_id: str,
    data: DocumentCreate,
    session: AsyncSession = Depends(get_db),
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Projekt nicht gefunden")

    doc_id = str(uuid4())
    doc = Document(
        id=doc_id,
        project_id=project_id,
        title=data.title,
        icon=data.icon,
    )
    session.add(doc)

    # Create initial empty paragraph block
    block = Block(
        id=str(uuid4()),
        document_id=doc_id,
        block_type="paragraph",
        content="",
        sort_order=0,
    )
    session.add(block)

    await session.commit()
    await session.refresh(doc)

    # Reload with blocks
    result = await session.execute(
        select(Document)
        .options(selectinload(Document.blocks))
        .where(Document.id == doc_id)
    )
    doc = result.scalar_one()
    return _doc_detail_response(doc)


# IMPORTANT: /recent must be defined BEFORE /{document_id}
@router.get(
    "/documents/recent",
    response_model=list[DocumentResponse],
)
async def recent_documents(
    limit: int = 20, session: AsyncSession = Depends(get_db)
):
    result = await session.execute(
        select(
            Document,
            func.count(Block.id).label("block_count"),
        )
        .outerjoin(Block, Block.document_id == Document.id)
        .group_by(Document.id)
        .order_by(Document.updated_at.desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        DocumentResponse(
            id=doc.id,
            project_id=doc.project_id,
            title=doc.title,
            icon=doc.icon,
            is_pinned=doc.is_pinned,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
            block_count=count,
        )
        for doc, count in rows
    ]


@router.get(
    "/documents/{document_id}",
    response_model=DocumentDetailResponse,
)
async def get_document(
    document_id: str, session: AsyncSession = Depends(get_db)
):
    result = await session.execute(
        select(Document)
        .options(selectinload(Document.blocks))
        .where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Dokument nicht gefunden")
    return _doc_detail_response(doc)


@router.patch(
    "/documents/{document_id}",
    response_model=DocumentDetailResponse,
)
async def update_document(
    document_id: str,
    data: DocumentUpdate,
    session: AsyncSession = Depends(get_db),
):
    doc = await session.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Dokument nicht gefunden")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)

    await session.commit()

    # Reload with blocks
    result = await session.execute(
        select(Document)
        .options(selectinload(Document.blocks))
        .where(Document.id == document_id)
    )
    doc = result.scalar_one()
    return _doc_detail_response(doc)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str, session: AsyncSession = Depends(get_db)
):
    doc = await session.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Dokument nicht gefunden")

    await session.delete(doc)
    await session.commit()


# ── Block CRUD ─────────────────────────────────────────────────


@router.post(
    "/documents/{document_id}/blocks",
    response_model=BlockResponse,
    status_code=201,
)
async def create_block(
    document_id: str,
    data: BlockCreate,
    session: AsyncSession = Depends(get_db),
):
    doc = await session.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Dokument nicht gefunden")

    block = Block(
        id=str(uuid4()),
        document_id=document_id,
        block_type=data.block_type,
        content=data.content,
        sort_order=data.sort_order,
        indent_level=data.indent_level,
        meta_json=data.meta_json,
    )
    session.add(block)
    await session.commit()
    await session.refresh(block)
    return block


@router.patch("/blocks/{block_id}", response_model=BlockResponse)
async def update_block(
    block_id: str,
    data: BlockUpdate,
    session: AsyncSession = Depends(get_db),
):
    block = await session.get(Block, block_id)
    if not block:
        raise HTTPException(404, "Block nicht gefunden")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(block, field, value)

    await session.commit()
    await session.refresh(block)
    return block


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_block(
    block_id: str, session: AsyncSession = Depends(get_db)
):
    block = await session.get(Block, block_id)
    if not block:
        raise HTTPException(404, "Block nicht gefunden")

    await session.delete(block)
    await session.commit()


@router.patch(
    "/documents/{document_id}/blocks/reorder",
    response_model=list[BlockResponse],
)
async def reorder_blocks(
    document_id: str,
    data: BulkBlockReorder,
    session: AsyncSession = Depends(get_db),
):
    doc = await session.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Dokument nicht gefunden")

    for pos in data.positions:
        block = await session.get(Block, pos.id)
        if block and block.document_id == document_id:
            block.sort_order = pos.sort_order

    await session.commit()

    result = await session.execute(
        select(Block)
        .where(Block.document_id == document_id)
        .order_by(Block.sort_order.asc())
    )
    return result.scalars().all()


# ── Helpers ────────────────────────────────────────────────────


def _doc_detail_response(doc: Document) -> DocumentDetailResponse:
    sorted_blocks = sorted(doc.blocks, key=lambda b: b.sort_order)
    return DocumentDetailResponse(
        id=doc.id,
        project_id=doc.project_id,
        title=doc.title,
        icon=doc.icon,
        is_pinned=doc.is_pinned,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        blocks=[BlockResponse.model_validate(b) for b in sorted_blocks],
    )
