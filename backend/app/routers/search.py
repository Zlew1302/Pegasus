import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.schemas.search import SearchResults
from app.services.search_service import parse_query, search_all

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=SearchResults)
async def search(
    q: str = Query(default="", description="Suchbegriff"),
    type: str | None = Query(default=None, description="task|project|document|comment"),
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    project_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Erweiterte Suche über Tasks, Projekte, Dokumente und Kommentare."""
    parsed = parse_query(q)
    results = await search_all(
        parsed=parsed,
        user_id=user_id,
        search_type=type,
        status_filter=status,
        priority_filter=priority,
        project_id_filter=project_id,
        limit=limit,
        db=db,
    )
    return SearchResults(results=results, total=len(results), query=q)
