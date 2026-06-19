"""
Analytics routes — Phase 6 (admin only).

Platform-wide stats via MongoDB aggregation pipelines.
"""

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import require_admin
from app.database import get_database
from app.models.analytics import AnalyticsDashboard
from app.models.user import UserResponse
from app.services.analytics_service import get_dashboard_stats

router = APIRouter()


@router.get("/dashboard", response_model=AnalyticsDashboard)
async def dashboard(
    _admin: UserResponse = Depends(require_admin),
    days: int = Query(default=30, ge=1, le=365, description="Days of submission volume history"),
    top_n: int = Query(default=10, ge=1, le=50, description="Leaderboard size"),
):
    """
    Admin analytics dashboard.

    Includes submission volume over time, verdict breakdowns, appeal stats,
    and ranked user lists by submissions and violations.
    """
    db = get_database()
    return await get_dashboard_stats(db, days=days, top_n=top_n)
