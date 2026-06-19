"""
Pydantic models for the AI Content Moderation Platform verdict system.

Maps directly to PDF sections 3 (Moderation Categories) and 4.2 (Verdict System).
"""

from datetime import datetime
from enum import Enum
from typing import List

from pydantic import BaseModel, Field, field_validator, model_validator


class ModerationCategory(str, Enum):
    """The six fixed moderation categories (section 3)."""
    GRAPHIC_VIOLENCE = "Graphic Violence"
    HATE_SYMBOLS = "Hate Symbols"
    SELF_HARM = "Self-Harm"
    EXTREMIST_PROPAGANDA = "Extremist Propaganda"
    WEAPONS_CONTRABAND = "Weapons & Contraband"
    HARASSMENT_HUMILIATION = "Harassment & Humiliation"


class ClassificationResult(str, Enum):
    """Whether this category's confidence met the configured threshold."""
    CLEAR = "clear"
    DETECTED = "detected"


class OverallOutcome(str, Enum):
    """Section 4.2: 'Approved, Flagged for Review, or Blocked.'"""
    APPROVED = "Approved"
    FLAGGED_FOR_REVIEW = "Flagged for Review"
    BLOCKED = "Blocked"


class EnforcementAction(str, Enum):
    """Section 4.4: per-category admin-configured enforcement behavior."""
    AUTO_BLOCK = "Auto-Block"
    FLAG_FOR_REVIEW = "Flag for Review"


class AppealOverride(BaseModel):
    """
    Audit record when an admin appeal acceptance overrides a verdict.

    original_overall_outcome stays frozen; overall_outcome becomes Approved.
    """

    appeal_id: str
    previous_outcome: OverallOutcome
    overridden_at: datetime = Field(default_factory=datetime.utcnow)
    overridden_by: str = Field(description="Admin user id who accepted the appeal")


class CategoryVerdict(BaseModel):
    """One category's result within a single image's verdict."""
    category: ModerationCategory
    result: ClassificationResult
    confidence: float = Field(ge=0, le=100, description="Confidence score as a percentage")
    reasoning: str = Field(min_length=1, description="Short explanation for this category's result")


class ImageVerdict(BaseModel):
    """
    Verdict for a single submitted image (section 4.2).

    category_breakdown intentionally does NOT require all 6 categories:
    section 4.4 states disabled categories are 'skipped during screening',
    so a verdict can legitimately contain fewer than 6 entries.
    """
    image_id: str = Field(description="Reference to the submitted image")
    overall_outcome: OverallOutcome = Field(
        description="Current effective outcome (may be overridden by an accepted appeal)"
    )
    original_overall_outcome: OverallOutcome = Field(
        description="AI-computed outcome at screening time — never modified after creation"
    )
    category_breakdown: List[CategoryVerdict]
    policy_version_id: str = Field(
        description="Reference to the policy configuration active at screening time"
    )
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)
    appeal_override: AppealOverride | None = Field(
        default=None,
        description="Set when an admin accepts an appeal for this image",
    )

    @field_validator("category_breakdown")
    @classmethod
    def no_duplicate_or_excess_categories(cls, v: List[CategoryVerdict]) -> List[CategoryVerdict]:
        seen = [item.category for item in v]
        if len(seen) != len(set(seen)):
            raise ValueError("Duplicate categories are not allowed in a single image verdict")
        if len(v) > len(ModerationCategory):
            raise ValueError("category_breakdown cannot exceed the number of defined categories")
        return v

    @model_validator(mode="after")
    def outcome_must_be_backed_by_a_detection(self) -> "ImageVerdict":
        """
        A submission is clean only if no category met its threshold.
        Exception: an accepted appeal may set overall_outcome to Approved
        while detections remain visible in category_breakdown for audit.
        """
        if self.appeal_override is not None:
            if self.overall_outcome != OverallOutcome.APPROVED:
                raise ValueError("An appeal override must set overall_outcome to 'Approved'")
            return self

        any_detected = any(c.result == ClassificationResult.DETECTED for c in self.category_breakdown)

        if self.overall_outcome == OverallOutcome.APPROVED and any_detected:
            raise ValueError("overall_outcome is 'Approved' but a category was detected")

        if self.overall_outcome != OverallOutcome.APPROVED and not any_detected:
            raise ValueError(
                f"overall_outcome is '{self.overall_outcome.value}' but no category was detected"
            )
        return self


class Submission(BaseModel):
    """A single user submission (section 4.1): one or more images, each screened independently."""
    id: str
    user_id: str
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    image_verdicts: List[ImageVerdict] = Field(
        min_length=1,
        description="One verdict per submitted image",
    )
