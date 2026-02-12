"""Decision Tracks API — organizational learning insights."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.track_service import (
    get_entity_graph,
    get_instance_tracks,
    get_org_insights,
    get_workflow_suggestions,
)

router = APIRouter(prefix="/api/tracks", tags=["tracks"])


@router.get("/insights")
async def get_insights(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Organizational structure insights from accumulated tracks."""
    return await get_org_insights(
        session=db,
        limit=limit,
    )


@router.get("/patterns")
async def get_patterns(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Learned workflow patterns."""
    return await get_workflow_suggestions(
        session=db,
        task_title="",
        task_description="",
        limit=limit,
    )


@router.get("/entities")
async def get_entities(
    limit: int = Query(100, ge=1, le=500),
    schema_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Entity relationship graph data for visualization."""
    return await get_entity_graph(
        session=db,
        limit=limit,
        schema_type=schema_type,
    )


@router.get("/instance/{instance_id}")
async def get_tracks_for_instance(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Track points for a specific agent run."""
    points = await get_instance_tracks(
        session=db,
        instance_id=instance_id,
    )
    return {
        "instance_id": instance_id,
        "track_points": points,
        "total_points": len(points),
    }
