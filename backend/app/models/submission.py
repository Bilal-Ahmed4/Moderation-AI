"""
Submission API models — Phase 4.

Domain verdict types live in moderation_models.py; this file adds
storage metadata and list/detail response shapes for the REST API.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.moderation_models import ImageVerdict, ModerationCategory, OverallOutcome


class StoredImage(BaseModel):
    """Metadata for one uploaded image — URL points to Cloudinary."""

    image_id: str
    original_filename: str
    content_type: str
    image_url: str = Field(default="", description="Cloudinary secure URL for display")
    cloudinary_public_id: str = Field(default="", description="Used for Cloudinary cleanup")
    storage_path: str = Field(
        default="",
        description="Legacy local path — only set for older disk-based uploads",
    )


class SubmissionResponse(BaseModel):
    """Full submission returned after upload or when fetching by id."""

    id: str
    user_id: str
    submitted_at: datetime
    images: list[StoredImage]
    image_verdicts: list[ImageVerdict]


class SubmissionListResponse(BaseModel):
    """Paginated submission history."""

    items: list[SubmissionResponse]
    total: int
    limit: int
    skip: int


class SubmissionFilterParams(BaseModel):
    """Query filters for GET /api/submissions (section 4.1)."""

    outcome: OverallOutcome | None = None
    category: ModerationCategory | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    limit: int = Field(default=20, ge=1, le=100)
    skip: int = Field(default=0, ge=0)
