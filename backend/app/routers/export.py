import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.services.export_service import (
    export_project_csv,
    export_project_excel,
    export_project_pdf,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/export", tags=["export"])


@router.get("")
async def export_project(
    project_id: str,
    format: str = Query(default="csv", description="csv|excel|pdf"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Projekt exportieren als CSV, Excel oder PDF."""
    if format == "csv":
        data = await export_project_csv(db, project_id)
        return StreamingResponse(
            iter([data]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=projekt_{project_id}.csv"},
        )
    elif format == "excel":
        data = await export_project_excel(db, project_id)
        return StreamingResponse(
            iter([data]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=projekt_{project_id}.xlsx"},
        )
    elif format == "pdf":
        data = await export_project_pdf(db, project_id)
        return StreamingResponse(
            iter([data]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=projekt_{project_id}.pdf"},
        )
    else:
        raise HTTPException(status_code=422, detail="Ungueltiges Format. Erlaubt: csv, excel, pdf")
