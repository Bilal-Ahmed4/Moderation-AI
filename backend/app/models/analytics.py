"""
Analytics response models — Phase 6.

Structured dashboard payload returned by GET /api/analytics/dashboard.
All figures come from MongoDB aggregation pipelines — no new collections.
"""

from pydantic import BaseModel, Field


class TimeSeriesPoint(BaseModel):
    """Submission count for one calendar day."""

    date: str
    count: int


class OutcomeCount(BaseModel):
    """Image verdict count grouped by overall outcome."""

    outcome: str
    count: int


class CategoryCount(BaseModel):
    """Detected violation count grouped by moderation category."""

    category: str
    count: int


class AppealStats(BaseModel):
    """Appeal volume and resolution breakdown."""

    total: int
    pending: int
    accepted: int
    rejected: int
    resolved: int = Field(description="accepted + rejected")
    resolution_rate: float = Field(
        description="Percent of appeals that reached a final decision (0–100)"
    )


class UserRankItem(BaseModel):
    """One row in a ranked user leaderboard."""

    user_id: str
    email: str
    full_name: str = ""
    count: int


class AnalyticsDashboard(BaseModel):
    """Full admin analytics dashboard."""

    submission_volume: list[TimeSeriesPoint]
    verdict_by_outcome: list[OutcomeCount]
    verdict_by_category: list[CategoryCount]
    appeals: AppealStats
    top_users_by_submissions: list[UserRankItem]
    top_users_by_violations: list[UserRankItem]
