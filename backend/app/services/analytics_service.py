"""
Analytics service — Phase 6.

Pure MongoDB aggregation over existing collections:
  submissions, appeals, users

No new collections or domain models — only read-only queries.
"""

from datetime import datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.analytics import (
    AnalyticsDashboard,
    AppealStats,
    CategoryCount,
    OutcomeCount,
    TimeSeriesPoint,
    UserRankItem,
)
from app.services.appeal_service import APPEALS_COLLECTION
from app.services.submission_service import SUBMISSIONS_COLLECTION

USERS_COLLECTION = "users"


async def _enrich_user_ranks(
    db: AsyncIOMotorDatabase,
    rank_rows: list[dict],
    count_field: str,
) -> list[UserRankItem]:
    """Attach email and name from the users collection to leaderboard rows."""
    if not rank_rows:
        return []

    from bson import ObjectId

    user_ids = [row["_id"] for row in rank_rows]
    object_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]

    user_map: dict[str, dict] = {}
    if object_ids:
        async for user_doc in db[USERS_COLLECTION].find(
            {"_id": {"$in": object_ids}},
            {"email": 1, "full_name": 1},
        ):
            user_map[str(user_doc["_id"])] = user_doc

    results: list[UserRankItem] = []
    for row in rank_rows:
        user_id = row["_id"]
        user_doc = user_map.get(user_id, {})
        results.append(
            UserRankItem(
                user_id=user_id,
                email=user_doc.get("email", "unknown"),
                full_name=user_doc.get("full_name", ""),
                count=row[count_field],
            )
        )
    return results


async def _submission_volume_over_time(
    db: AsyncIOMotorDatabase,
    since: datetime,
) -> list[TimeSeriesPoint]:
    """Total submission count per day since `since`."""
    pipeline = [
        {"$match": {"submitted_at": {"$gte": since}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$submitted_at"}
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    rows = await db[SUBMISSIONS_COLLECTION].aggregate(pipeline).to_list(length=None)
    return [TimeSeriesPoint(date=row["_id"], count=row["count"]) for row in rows]


async def _verdict_distribution_by_outcome(db: AsyncIOMotorDatabase) -> list[OutcomeCount]:
    """Count images grouped by current effective overall_outcome."""
    pipeline = [
        {"$unwind": "$image_verdicts"},
        {
            "$group": {
                "_id": "$image_verdicts.overall_outcome",
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"count": -1}},
    ]
    rows = await db[SUBMISSIONS_COLLECTION].aggregate(pipeline).to_list(length=None)
    return [OutcomeCount(outcome=row["_id"], count=row["count"]) for row in rows]


async def _verdict_distribution_by_category(db: AsyncIOMotorDatabase) -> list[CategoryCount]:
    """Count detected violations grouped by moderation category."""
    pipeline = [
        {"$unwind": "$image_verdicts"},
        {"$unwind": "$image_verdicts.category_breakdown"},
        {"$match": {"image_verdicts.category_breakdown.result": "detected"}},
        {
            "$group": {
                "_id": "$image_verdicts.category_breakdown.category",
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"count": -1}},
    ]
    rows = await db[SUBMISSIONS_COLLECTION].aggregate(pipeline).to_list(length=None)
    return [CategoryCount(category=row["_id"], count=row["count"]) for row in rows]


async def _appeal_stats(db: AsyncIOMotorDatabase) -> AppealStats:
    """Appeal volume, resolution rate, and accepted vs rejected breakdown."""
    pipeline = [
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
            }
        }
    ]
    rows = await db[APPEALS_COLLECTION].aggregate(pipeline).to_list(length=None)
    counts = {row["_id"]: row["count"] for row in rows}

    pending = counts.get("pending", 0)
    accepted = counts.get("accepted", 0)
    rejected = counts.get("rejected", 0)
    total = pending + accepted + rejected
    resolved = accepted + rejected
    resolution_rate = round((resolved / total) * 100, 1) if total > 0 else 0.0

    return AppealStats(
        total=total,
        pending=pending,
        accepted=accepted,
        rejected=rejected,
        resolved=resolved,
        resolution_rate=resolution_rate,
    )


async def _top_users_by_submissions(
    db: AsyncIOMotorDatabase,
    top_n: int,
) -> list[UserRankItem]:
    """Rank users by number of submissions."""
    pipeline = [
        {"$group": {"_id": "$user_id", "submission_count": {"$sum": 1}}},
        {"$sort": {"submission_count": -1}},
        {"$limit": top_n},
    ]
    rows = await db[SUBMISSIONS_COLLECTION].aggregate(pipeline).to_list(length=top_n)
    return await _enrich_user_ranks(db, rows, "submission_count")


async def _top_users_by_violations(
    db: AsyncIOMotorDatabase,
    top_n: int,
) -> list[UserRankItem]:
    """
    Rank users by images flagged/blocked at screening time.

    Uses original_overall_outcome (falls back to overall_outcome for older docs).
    """
    pipeline = [
        {"$unwind": "$image_verdicts"},
        {
            "$addFields": {
                "screening_outcome": {
                    "$ifNull": [
                        "$image_verdicts.original_overall_outcome",
                        "$image_verdicts.overall_outcome",
                    ]
                }
            }
        },
        {"$match": {"screening_outcome": {"$ne": "Approved"}}},
        {"$group": {"_id": "$user_id", "violation_count": {"$sum": 1}}},
        {"$sort": {"violation_count": -1}},
        {"$limit": top_n},
    ]
    rows = await db[SUBMISSIONS_COLLECTION].aggregate(pipeline).to_list(length=top_n)
    return await _enrich_user_ranks(db, rows, "violation_count")


async def get_dashboard_stats(
    db: AsyncIOMotorDatabase,
    *,
    days: int = 30,
    top_n: int = 10,
) -> AnalyticsDashboard:
    """
    Build the full admin analytics dashboard.

    Args:
        days: How many days back to include in submission volume chart.
        top_n: Number of users in each leaderboard.
    """
    since = datetime.utcnow() - timedelta(days=days)

    submission_volume = await _submission_volume_over_time(db, since)
    verdict_by_outcome = await _verdict_distribution_by_outcome(db)
    verdict_by_category = await _verdict_distribution_by_category(db)
    appeals = await _appeal_stats(db)
    top_users_by_submissions = await _top_users_by_submissions(db, top_n)
    top_users_by_violations = await _top_users_by_violations(db, top_n)

    return AnalyticsDashboard(
        submission_volume=submission_volume,
        verdict_by_outcome=verdict_by_outcome,
        verdict_by_category=verdict_by_category,
        appeals=appeals,
        top_users_by_submissions=top_users_by_submissions,
        top_users_by_violations=top_users_by_violations,
    )
