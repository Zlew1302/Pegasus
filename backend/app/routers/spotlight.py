"""Spotlight AI chat endpoint — POST with SSE streaming response."""

import json
from uuid import uuid4

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.schemas.spotlight import SpotlightChatRequest
from app.services.spotlight_service import chat_stream

router = APIRouter(prefix="/api/spotlight", tags=["spotlight"])


@router.post("/chat")
async def spotlight_chat(body: SpotlightChatRequest, request: Request):
    """Chat with the Spotlight AI assistant. Returns an SSE stream."""
    if not settings.ANTHROPIC_API_KEY:
        async def error_gen():
            yield {
                "event": "error",
                "data": json.dumps({"message": "Kein ANTHROPIC_API_KEY konfiguriert."}),
            }
        return EventSourceResponse(error_gen())

    session_id = str(uuid4())

    context = {
        "current_path": body.context.current_path,
        "current_page_type": body.context.current_page_type,
        "current_entity_id": body.context.current_entity_id,
        "current_entity_title": body.context.current_entity_title,
    }

    history = [{"role": m.role, "content": m.content} for m in body.history]

    async def event_generator():
        try:
            async for sse_event in chat_stream(
                message=body.message,
                context=context,
                history=history,
                session_id=session_id,
            ):
                if await request.is_disconnected():
                    break
                yield {
                    "event": sse_event.event,
                    "data": json.dumps(sse_event.data, default=str),
                }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"Interner Fehler: {str(e)}"}),
            }

    return EventSourceResponse(event_generator())
