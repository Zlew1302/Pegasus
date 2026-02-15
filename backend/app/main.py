import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.middleware import (
    RateLimitMiddleware,
    RequestContextMiddleware,
    register_error_handlers,
    setup_logging,
)
from app.models import Base
from app.routers import (
    activity, agents, approvals, attachments, commands, comments, dashboard,
    documents, export, knowledge, notifications, outputs, profile,
    projects, saved_views, search, spotlight, stream, tasks, teams,
    templates, time_tracking, todos, tracks, webhooks,
)

# Initialize structured logging before anything else
setup_logging(debug=os.getenv("DEBUG", "").lower() in ("1", "true"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed only essential system data (agent types + user profile)
    from app.seed import seed_essentials
    await seed_essentials()
    # Ensure uploads directory exists
    os.makedirs(os.path.join(os.getcwd(), "uploads"), exist_ok=True)
    os.makedirs(os.path.join(os.getcwd(), "uploads", "attachments"), exist_ok=True)
    # Start recurring task scheduler
    import asyncio
    from app.database import async_session
    from app.services.scheduler_service import scheduler_loop
    asyncio.create_task(scheduler_loop(async_session))
    yield


app = FastAPI(
    title="CrewBoard API",
    version="0.1.0",
    description="PM-Tool mit KI-Agenten",
    lifespan=lifespan,
)

# Middleware (order matters — outermost first)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(RateLimitMiddleware)

# Global error handlers — no stack traces to client
register_error_handlers(app)

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
app.include_router(spotlight.router)
app.include_router(knowledge.router)
app.include_router(tracks.router)
app.include_router(activity.router)
app.include_router(attachments.router)
app.include_router(search.router)
app.include_router(time_tracking.router)
app.include_router(templates.router)
app.include_router(webhooks.router)
app.include_router(export.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
