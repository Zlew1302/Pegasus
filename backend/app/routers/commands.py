from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import AgentType
from app.models.project import Project
from app.models.task import Task

router = APIRouter(prefix="/api/commands", tags=["commands"])


@router.get("/search")
async def search_commands(
    q: str = Query("", min_length=0),
    db: AsyncSession = Depends(get_db),
):
    results = {"tasks": [], "projects": [], "agents": []}

    if not q:
        # Return recent items
        tasks = await db.execute(
            select(Task).order_by(Task.updated_at.desc()).limit(5)
        )
        projects = await db.execute(
            select(Project).order_by(Project.updated_at.desc()).limit(5)
        )
        agents = await db.execute(select(AgentType).order_by(AgentType.name))
    else:
        pattern = f"%{q}%"
        tasks = await db.execute(
            select(Task)
            .where(Task.title.ilike(pattern) | Task.description.ilike(pattern))
            .limit(10)
        )
        projects = await db.execute(
            select(Project)
            .where(Project.title.ilike(pattern) | Project.description.ilike(pattern))
            .limit(5)
        )
        agents = await db.execute(
            select(AgentType).where(AgentType.name.ilike(pattern)).limit(5)
        )

    results["tasks"] = [
        {"id": t.id, "title": t.title, "status": t.status, "project_id": t.project_id}
        for t in tasks.scalars().all()
    ]
    results["projects"] = [
        {"id": p.id, "title": p.title, "status": p.status}
        for p in projects.scalars().all()
    ]
    results["agents"] = [
        {"id": a.id, "name": a.name, "description": a.description}
        for a in agents.scalars().all()
    ]

    return results
