"""
FastAPI dependencies for protecting routes.

Usage:
    @router.get("/something")
    async def route(user: UserResponse = Depends(get_current_user)):
        ...

    @router.get("/admin-only")
    async def admin_route(user: UserResponse = Depends(require_admin)):
        ...
"""

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt_handler import decode_access_token
from app.database import get_database
from app.models.user import UserResponse, UserRole
from app.services.user_service import get_user_by_id, user_to_response

# auto_error=False so we can return our own 401 message instead of FastAPI's default.
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> UserResponse:
    """
    Validate the JWT and load the live user from MongoDB.

    We re-fetch from the DB so deleted users cannot keep using old tokens.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    db = get_database()
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )

    return user_to_response(user)


async def get_image_viewer(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    token: str | None = Query(default=None),
) -> UserResponse:
    """
    Auth dependency specifically for the image-serving endpoint.

    <img> tags in the browser can't send an Authorization header, so the
    frontend embeds the token as a ?token= query param instead. This
    dependency accepts either form so both cases work.
    """
    # Header takes priority — if both are present, use the header.
    raw_token = credentials.credentials if credentials else token

    if raw_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(raw_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    db = get_database()
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )

    return user_to_response(user)


async def require_admin(
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    """
    Gate admin-only routes (appeals queue, policy config, analytics).

    Raises 403 if the authenticated user is not an admin.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
