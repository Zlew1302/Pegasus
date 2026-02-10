import asyncio
import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.sse.manager import sse_manager

router = APIRouter(tags=["stream"])


@router.get("/api/stream/{instance_id}")
async def stream_agent(instance_id: str, request: Request):
    queue = sse_manager.subscribe(instance_id)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield {
                        "event": event.event,
                        "data": json.dumps(event.data, default=str),
                    }
                    if event.event in ("completed", "error", "cancelled"):
                        break
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
        finally:
            sse_manager.unsubscribe(instance_id, queue)

    return EventSourceResponse(event_generator())
