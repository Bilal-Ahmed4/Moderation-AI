"""
Appeal routes — Phase 5.

Users file and track appeals. Admins review the pending queue and accept/reject.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user, require_admin
from app.database import get_database
from app.models.appeal import (
    AppealCreate,
    AppealListResponse,
    AppealResolveRequest,
    AppealResponse,
)
from app.models.user import UserResponse, UserRole
from app.services.appeal_service import (
    create_appeal,
    get_appeal_by_id,
    list_pending_appeals,
    list_user_appeals,
    resolve_appeal,
)

router = APIRouter()


@router.post("/", response_model=AppealResponse, status_code=status.HTTP_201_CREATED)
async def file_appeal(
    payload: AppealCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    File an appeal against a Flagged or Blocked image verdict.

    Requires a written justification (min 10 characters).
    """
    db = get_database()
    try:
        return await create_appeal(db, current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/", response_model=AppealListResponse)
async def get_my_appeals(
    current_user: UserResponse = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    """List appeals filed by the current user with status tracking."""
    db = get_database()
    return await list_user_appeals(db, current_user.id, limit=limit, skip=skip)


@router.get("/queue", response_model=AppealListResponse)
async def get_appeals_queue(
    _admin: UserResponse = Depends(require_admin),
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    """Admin-only pending appeals queue (oldest first)."""
    db = get_database()
    return await list_pending_appeals(db, limit=limit, skip=skip)


@router.get("/{appeal_id}", response_model=AppealResponse)
async def get_appeal(
    appeal_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get one appeal — owner or admin."""
    db = get_database()
    appeal = await get_appeal_by_id(db, appeal_id)
    if appeal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appeal not found")

    is_owner = appeal.user_id == current_user.id
    is_admin = current_user.role == UserRole.ADMIN
    if not is_owner and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return appeal


@router.post("/{appeal_id}/resolve", response_model=AppealResponse)
async def resolve_appeal_route(
    appeal_id: str,
    payload: AppealResolveRequest,
    admin: UserResponse = Depends(require_admin),
):
    """
    Admin accepts or rejects a pending appeal.

    Accept → overrides that image's overall_outcome to Approved (audit trail kept).
    Reject → verdict unchanged; optional admin_response returned to user.
    """
    db = get_database()
    try:
        return await resolve_appeal(
            db,
            appeal_id,
            admin.id,
            payload.action,
            payload.admin_response,
        )
    except ValueError as exc:
        status_code = (
            status.HTTP_404_NOT_FOUND
            if str(exc) == "Appeal not found"
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
