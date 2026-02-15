import logging
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.attachment import TaskAttachment
from app.schemas.attachment import AttachmentResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["attachments"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "attachments")
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "md", "csv", "json", "xml", "html",
    "png", "jpg", "jpeg", "gif", "webp", "svg",
    "zip", "gz", "tar",
    "py", "js", "ts", "tsx", "jsx", "css", "scss",
    "mp3", "mp4", "wav",
    "log", "yaml", "yml", "toml",
}


def _get_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _safe_filename(attachment_id: str, original: str) -> str:
    ext = _get_extension(original)
    safe = original.replace("/", "_").replace("\\", "_").replace("..", "_")
    return f"{attachment_id}_{safe}"


@router.post(
    "/tasks/{task_id}/attachments",
    response_model=AttachmentResponse,
    status_code=201,
)
async def upload_attachment(
    task_id: str,
    file: UploadFile,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Datei an eine Aufgabe anhängen."""
    if not file.filename:
        raise HTTPException(status_code=422, detail="Dateiname fehlt")

    ext = _get_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Dateityp .{ext} ist nicht erlaubt",
        )

    # Read file content
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=422, detail="Datei ist leer")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=422,
            detail=f"Datei zu groß (max. {MAX_FILE_SIZE // 1024 // 1024} MB)",
        )

    attachment_id = str(uuid4())
    safe_name = _safe_filename(attachment_id, file.filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    # Write file
    with open(file_path, "wb") as f:
        f.write(content)

    # Detect MIME type
    mime_type = file.content_type or "application/octet-stream"

    attachment = TaskAttachment(
        id=attachment_id,
        task_id=task_id,
        filename=safe_name,
        original_filename=file.filename,
        file_path=file_path,
        file_size_bytes=len(content),
        mime_type=mime_type,
        uploaded_by=user_id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return AttachmentResponse.model_validate(attachment)


@router.get("/tasks/{task_id}/attachments", response_model=list[AttachmentResponse])
async def list_attachments(
    task_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alle Anhänge einer Aufgabe auflisten."""
    result = await db.execute(
        select(TaskAttachment)
        .where(TaskAttachment.task_id == task_id)
        .order_by(TaskAttachment.created_at.desc())
    )
    return [AttachmentResponse.model_validate(a) for a in result.scalars().all()]


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Anhang herunterladen."""
    result = await db.execute(
        select(TaskAttachment).where(TaskAttachment.id == attachment_id)
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Anhang nicht gefunden")

    if not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")

    return FileResponse(
        path=attachment.file_path,
        filename=attachment.original_filename,
        media_type=attachment.mime_type,
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Anhang löschen."""
    result = await db.execute(
        select(TaskAttachment).where(TaskAttachment.id == attachment_id)
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Anhang nicht gefunden")

    # Delete file from disk
    if os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)

    await db.delete(attachment)
    await db.commit()
