"""Application middleware — error handling, request IDs, rate limiting, structured logging."""

import collections
import logging
import os
import time
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# Context var for request ID — accessible anywhere during request lifecycle
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

logger = logging.getLogger("crewboard")


# ── Structured Logging Setup ─────────────────────────────────────


class RequestIdFilter(logging.Filter):
    """Injects request_id into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get("")  # type: ignore[attr-defined]
        return True


def setup_logging(debug: bool = False) -> None:
    """Configure structured JSON-like logging for production."""
    level = logging.DEBUG if debug else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-5s | %(request_id)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    handler.addFilter(RequestIdFilter())

    # Root logger
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Suppress noisy libraries
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


# ── Request ID + Logging Middleware ───────────────────────────────


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns a unique request ID and logs request/response."""

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
        request_id_var.set(rid)

        start = time.perf_counter()

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Request-ID"] = rid

        # Log request completion (skip health checks)
        if request.url.path != "/api/health":
            logger.info(
                "%s %s → %s (%.1fms)",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )

        return response


# ── Rate Limiting ─────────────────────────────────────────────────


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory sliding-window rate limiter.

    Two tiers:
    - General API: 200 requests / 60s
    - Agent endpoints (Anthropic API calls): 20 requests / 60s
    """

    GENERAL_LIMIT = 200
    AGENT_LIMIT = 20
    WINDOW_SECONDS = 60

    # Paths that trigger the stricter agent limit
    AGENT_PATHS = {"/api/agents/", "/api/spotlight/"}

    def __init__(self, app):
        super().__init__(app)
        self._general: collections.deque = collections.deque()
        self._agent: collections.deque = collections.deque()

    def _is_agent_path(self, path: str) -> bool:
        return any(path.startswith(p) for p in self.AGENT_PATHS)

    def _clean_window(self, bucket: collections.deque, now: float) -> None:
        cutoff = now - self.WINDOW_SECONDS
        while bucket and bucket[0] < cutoff:
            bucket.popleft()

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and in testing
        if request.url.path == "/api/health" or os.getenv("TESTING"):
            return await call_next(request)

        now = time.time()
        path = request.url.path

        # Check agent rate limit
        if self._is_agent_path(path):
            self._clean_window(self._agent, now)
            if len(self._agent) >= self.AGENT_LIMIT:
                logger.warning("Agent rate limit exceeded for %s", path)
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": "Zu viele Anfragen. Bitte warten Sie einen Moment.",
                    },
                    headers={"Retry-After": "30"},
                )
            self._agent.append(now)

        # Check general rate limit
        self._clean_window(self._general, now)
        if len(self._general) >= self.GENERAL_LIMIT:
            logger.warning("General rate limit exceeded for %s", path)
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Zu viele Anfragen. Bitte warten Sie einen Moment.",
                },
                headers={"Retry-After": "10"},
            )
        self._general.append(now)

        return await call_next(request)


# ── Global Error Handler ──────────────────────────────────────────


def register_error_handlers(app: FastAPI) -> None:
    """Register exception handlers that never leak stack traces."""

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        rid = request_id_var.get("")
        logger.error(
            "Unhandled exception [%s %s]: %s: %s",
            request.method,
            request.url.path,
            type(exc).__name__,
            str(exc),
            exc_info=True,  # Full traceback in server logs only
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Interner Serverfehler. Bitte versuchen Sie es erneut.",
                "request_id": rid,
            },
        )

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Nicht gefunden."},
        )
