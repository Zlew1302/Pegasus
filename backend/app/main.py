from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models import Base
from app.routers import (
    agents, approvals, commands, comments, dashboard, documents, notifications, outputs, profile,
    projects, saved_views, stream, tasks, teams, todos,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Auto-seed demo data if DB is empty
    from app.seed import seed_database
    await seed_database()
    yield


app = FastAPI(
    title="CrewBoard API",
    version="0.1.0",
    description="PM-Tool mit KI-Agenten",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(agents.router)
app.include_router(outputs.router)
app.include_router(approvals.router)
app.include_router(stream.router)
app.include_router(commands.router)
app.include_router(dashboard.router)
app.include_router(todos.router)
app.include_router(profile.router)
app.include_router(comments.router)
app.include_router(notifications.router)
app.include_router(teams.router)
app.include_router(saved_views.router)
app.include_router(documents.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
