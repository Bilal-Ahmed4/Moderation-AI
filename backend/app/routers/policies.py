"""
Policy configuration routes — Phase 2 (admin only).

Every save creates a new immutable version. The active pointer moves forward;
old verdicts keep their original policy_version_id unchanged.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import require_admin
from app.database import get_database
from app.models.policy import (
    PolicyUpdateRequest,
    PolicyVersion,
    PolicyVersionListResponse,
)
from app.models.user import UserResponse
from app.services.policy_service import (
    create_policy_version,
    get_active_policy,
    get_policy_version_by_id,
    list_policy_versions,
)

router = APIRouter()


@router.get("/", response_model=PolicyVersionListResponse)
async def list_policies(
    _admin: UserResponse = Depends(require_admin),
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    """List all policy versions, newest first. Includes which version is active."""
    db = get_database()
    items, total, active_id = await list_policy_versions(db, limit=limit, skip=skip)
    return PolicyVersionListResponse(
        items=items,
        total=total,
        active_version_id=active_id,
    )


@router.get("/active", response_model=PolicyVersion)
async def get_active_policy_route(_admin: UserResponse = Depends(require_admin)):
    """Return the policy version currently used for new submissions."""
    db = get_database()
    policy = await get_active_policy(db)
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active policy configured",
        )
    return policy


@router.get("/{version_id}", response_model=PolicyVersion)
async def get_policy_version(
    version_id: str,
    _admin: UserResponse = Depends(require_admin),
):
    """Fetch a specific policy version by id (useful for audit / history)."""
    db = get_database()
    policy = await get_policy_version_by_id(db, version_id)
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy version not found",
        )
    return policy


@router.post("/", response_model=PolicyVersion, status_code=status.HTTP_201_CREATED)
async def save_policy(
    payload: PolicyUpdateRequest,
    admin: UserResponse = Depends(require_admin),
):
    """
    Save a new policy version and activate it immediately.

    Requires all six categories. Changes apply only to submissions made after
    this save — existing verdicts are not modified.
    """
    db = get_database()
    return await create_policy_version(db, payload, admin.id)
