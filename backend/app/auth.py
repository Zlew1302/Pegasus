"""User context dependency — single point for user identification.

Today: Returns "default-user" (single-user mode).
Tomorrow: Extract user_id from JWT token → multi-user with zero router changes.

Usage in routers:
    from app.auth import get_current_user
    @router.get("/items")
    async def list_items(user_id: str = Depends(get_current_user)):
        ...
"""

from fastapi import Request

# ── Configuration ─────────────────────────────────────────────

DEFAULT_USER_ID = "default-user"


# ── Dependency ────────────────────────────────────────────────


async def get_current_user(request: Request) -> str:
    """Extract user ID from request context.

    Single-user mode: always returns DEFAULT_USER_ID.

    Multi-user migration path:
        1. Add JWT auth middleware
        2. Replace this function body with token extraction
        3. All routers automatically work with real user IDs
    """
    # Future: Extract from JWT token
    # token = request.headers.get("Authorization", "").replace("Bearer ", "")
    # payload = decode_jwt(token)
    # return payload["user_id"]

    return DEFAULT_USER_ID
