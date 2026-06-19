"""
Appeal models — Phase 5.

Users appeal Flagged/Blocked image verdicts. Admins accept or reject from a
pending queue. Acceptance overrides that image's overall_outcome to Approved
while preserving the original AI outcome for audit.
"""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class AppealStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class AppealCreate(BaseModel):
    """User files an appeal against one image within a submission."""

    submission_id: str
    image_id: str
    justification: str = Field(min_length=10, description="Why the verdict is wrong")


class AppealResolveRequest(BaseModel):
    """Admin accepts or rejects a pending appeal."""

    action: Literal["accepted", "rejected"]
    admin_response: str = Field(default="", description="Optional written response to the user")


class AppealResponse(BaseModel):
    id: str
    submission_id: str
    image_id: str
    user_id: str
    justification: str
    status: AppealStatus = AppealStatus.PENDING
    admin_response: str = ""
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AppealListResponse(BaseModel):
    items: list[AppealResponse]
    total: int
    limit: int
    skip: int
