"""
Policy models — Phase 2.

Policies are stored as immutable versioned snapshots. Each admin save creates a
new policy_versions document. A separate policy_state pointer tracks which
version is currently active. Old verdicts keep their policy_version_id forever.
"""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.moderation_models import EnforcementAction, ModerationCategory


class CategoryPolicy(BaseModel):
    """Per-category settings: enabled, confidence threshold, enforcement action."""

    category: ModerationCategory
    enabled: bool = True
    threshold: float = Field(
        default=75.0,
        ge=0,
        le=100,
        description="Confidence % below which a detection is inconclusive",
    )
    enforcement: EnforcementAction = EnforcementAction.FLAG_FOR_REVIEW


class PolicyVersion(BaseModel):
    """One immutable policy snapshot stored in policy_versions."""

    id: str
    version: int
    categories: list[CategoryPolicy]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = Field(description="User id of the admin who saved this version")


class PolicyUpdateRequest(BaseModel):
    """
    Payload for POST /api/policies — admin saves a full new policy version.

    All six moderation categories must be present exactly once.
    """

    categories: list[CategoryPolicy] = Field(min_length=1)

    @field_validator("categories")
    @classmethod
    def must_include_all_categories_once(
        cls,
        categories: list[CategoryPolicy],
    ) -> list[CategoryPolicy]:
        provided = [item.category for item in categories]
        expected = list(ModerationCategory)

        if len(provided) != len(expected):
            raise ValueError(
                f"Policy must include all {len(expected)} categories; got {len(provided)}"
            )
        if len(provided) != len(set(provided)):
            raise ValueError("Duplicate categories are not allowed")
        if set(provided) != set(expected):
            missing = set(expected) - set(provided)
            extra = set(provided) - set(expected)
            parts = []
            if missing:
                parts.append(f"missing: {[c.value for c in missing]}")
            if extra:
                parts.append(f"unknown: {[c.value for c in extra]}")
            raise ValueError("; ".join(parts))

        # Stable order matching the enum definition.
        order = {cat: idx for idx, cat in enumerate(expected)}
        return sorted(categories, key=lambda c: order[c.category])


class PolicyVersionListResponse(BaseModel):
    """Response for GET /api/policies."""

    items: list[PolicyVersion]
    total: int
    active_version_id: str | None = None
