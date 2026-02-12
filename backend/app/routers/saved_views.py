from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.saved_view import SavedView
from app.schemas.saved_view import SavedViewCreate, SavedViewResponse, SavedViewUpdate

router = APIRouter(prefix="/api", tags=["saved_views"])


@router.get(
    "/projects/{project_id}/views", response_model=list[SavedViewResponse]
)
async def list_views(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SavedView)
        .where(SavedView.project_id == project_id)
        .order_by(SavedView.sort_order)
    )
    return result.scalars().all()


@router.post(
    "/projects/{project_id}/views",
    response_model=SavedViewResponse,
    status_code=201,
)
async def create_view(
    project_id: str,
    data: SavedViewCreate,
    db: AsyncSession = Depends(get_db),
):
    view = SavedView(
        id=str(uuid4()),
        name=data.name,
        project_id=project_id,
        filter_json=data.filter_json,
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)
    return view


@router.patch("/views/{view_id}", response_model=SavedViewResponse)
async def update_view(
    view_id: str,
    data: SavedViewUpdate,
    db: AsyncSession = Depends(get_db),
):
    view = await db.get(SavedView, view_id)
    if not view:
        raise HTTPException(404, "Ansicht nicht gefunden")

    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(view, key, value)

    await db.commit()
    await db.refresh(view)
    return view


@router.delete("/views/{view_id}", status_code=204)
async def delete_view(view_id: str, db: AsyncSession = Depends(get_db)):
    view = await db.get(SavedView, view_id)
    if not view:
        raise HTTPException(404, "Ansicht nicht gefunden")
    await db.delete(view)
    await db.commit()
