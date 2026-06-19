"""
Appeal service — Phase 5 (MongoDB `appeals` collection).

Users file appeals for Flagged/Blocked images. Admins review the pending queue.
Acceptance overrides the image verdict to Approved with a full audit trail.
"""

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.appeal import AppealCreate, AppealListResponse, AppealResponse, AppealStatus
from app.models.moderation_models import AppealOverride, ImageVerdict, OverallOutcome
from app.services.submission_service import (
    SUBMISSIONS_COLLECTION,
    _detected_categories_from_verdicts,
    _image_verdict_from_db,
    _image_verdict_to_db,
    _outcomes_from_verdicts,
)

APPEALS_COLLECTION = "appeals"


def _doc_to_appeal(doc: dict) -> AppealResponse:
    return AppealResponse(
        id=str(doc["_id"]),
        submission_id=doc["submission_id"],
        image_id=doc["image_id"],
        user_id=doc["user_id"],
        justification=doc["justification"],
        status=AppealStatus(doc["status"]),
        admin_response=doc.get("admin_response", ""),
        reviewed_by=doc.get("reviewed_by"),
        reviewed_at=doc.get("reviewed_at"),
        created_at=doc.get("created_at", datetime.utcnow()),
    )


async def ensure_appeal_indexes(db: AsyncIOMotorDatabase) -> None:
    """Indexes for user history and admin pending queue."""
    collection = db[APPEALS_COLLECTION]
    await collection.create_index([("user_id", 1), ("created_at", -1)])
    await collection.create_index([("status", 1), ("created_at", 1)])
    # One open appeal per image at a time.
    await collection.create_index(
        [("submission_id", 1), ("image_id", 1), ("status", 1)],
        name="submission_image_status",
    )


async def _get_submission_doc(db: AsyncIOMotorDatabase, submission_id: str) -> dict | None:
    if not ObjectId.is_valid(submission_id):
        return None
    return await db[SUBMISSIONS_COLLECTION].find_one({"_id": ObjectId(submission_id)})


def _find_image_verdict(doc: dict, image_id: str) -> ImageVerdict | None:
    for raw in doc.get("image_verdicts", []):
        verdict = _image_verdict_from_db(raw)
        if verdict.image_id == image_id:
            return verdict
    return None


async def create_appeal(
    db: AsyncIOMotorDatabase,
    user_id: str,
    payload: AppealCreate,
) -> AppealResponse:
    """
    File a new appeal.

    Raises ValueError with a human-readable message on validation failure.
    """
    submission = await _get_submission_doc(db, payload.submission_id)
    if submission is None:
        raise ValueError("Submission not found")
    if submission["user_id"] != user_id:
        raise ValueError("You can only appeal your own submissions")

    verdict = _find_image_verdict(submission, payload.image_id)
    if verdict is None:
        raise ValueError("Image not found in this submission")

    if verdict.overall_outcome == OverallOutcome.APPROVED:
        raise ValueError("Approved submissions cannot be appealed")

    if verdict.appeal_override is not None:
        raise ValueError("This image verdict was already overturned by an accepted appeal")

    existing_pending = await db[APPEALS_COLLECTION].find_one(
        {
            "submission_id": payload.submission_id,
            "image_id": payload.image_id,
            "status": AppealStatus.PENDING.value,
        }
    )
    if existing_pending is not None:
        raise ValueError("A pending appeal already exists for this image")

    now = datetime.utcnow()
    doc = {
        "submission_id": payload.submission_id,
        "image_id": payload.image_id,
        "user_id": user_id,
        "justification": payload.justification.strip(),
        "status": AppealStatus.PENDING.value,
        "admin_response": "",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now,
    }
    result = await db[APPEALS_COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_appeal(doc)


async def list_user_appeals(
    db: AsyncIOMotorDatabase,
    user_id: str,
    *,
    limit: int = 20,
    skip: int = 0,
) -> AppealListResponse:
    """Return appeals filed by the current user."""
    query = {"user_id": user_id}
    collection = db[APPEALS_COLLECTION]
    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    items = [_doc_to_appeal(doc) async for doc in cursor]
    return AppealListResponse(items=items, total=total, limit=limit, skip=skip)


async def list_pending_appeals(
    db: AsyncIOMotorDatabase,
    *,
    limit: int = 50,
    skip: int = 0,
) -> AppealListResponse:
    """Admin queue — all pending appeals oldest first."""
    query = {"status": AppealStatus.PENDING.value}
    collection = db[APPEALS_COLLECTION]
    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("created_at", 1).skip(skip).limit(limit)
    items = [_doc_to_appeal(doc) async for doc in cursor]
    return AppealListResponse(items=items, total=total, limit=limit, skip=skip)


async def get_appeal_by_id(db: AsyncIOMotorDatabase, appeal_id: str) -> AppealResponse | None:
    if not ObjectId.is_valid(appeal_id):
        return None
    doc = await db[APPEALS_COLLECTION].find_one({"_id": ObjectId(appeal_id)})
    if doc is None:
        return None
    return _doc_to_appeal(doc)


async def _apply_verdict_override(
    db: AsyncIOMotorDatabase,
    submission_id: str,
    image_id: str,
    appeal_id: str,
    admin_user_id: str,
) -> None:
    """On appeal acceptance, override the image verdict and refresh denormalized fields."""
    submission = await _get_submission_doc(db, submission_id)
    if submission is None:
        raise ValueError("Submission not found")

    updated_verdicts: list[dict] = []
    target_verdict: ImageVerdict | None = None

    for raw in submission.get("image_verdicts", []):
        verdict = _image_verdict_from_db(raw)
        if verdict.image_id == image_id:
            override = AppealOverride(
                appeal_id=appeal_id,
                previous_outcome=verdict.overall_outcome,
                overridden_by=admin_user_id,
            )
            verdict = ImageVerdict(
                image_id=verdict.image_id,
                overall_outcome=OverallOutcome.APPROVED,
                original_overall_outcome=verdict.original_overall_outcome,
                category_breakdown=verdict.category_breakdown,
                policy_version_id=verdict.policy_version_id,
                evaluated_at=verdict.evaluated_at,
                appeal_override=override,
            )
            target_verdict = verdict
        updated_verdicts.append(_image_verdict_to_db(verdict))

    if target_verdict is None:
        raise ValueError("Image verdict not found in submission")

    parsed_verdicts = [_image_verdict_from_db(item) for item in updated_verdicts]
    await db[SUBMISSIONS_COLLECTION].update_one(
        {"_id": ObjectId(submission_id)},
        {
            "$set": {
                "image_verdicts": updated_verdicts,
                "outcomes": _outcomes_from_verdicts(parsed_verdicts),
                "detected_categories": _detected_categories_from_verdicts(parsed_verdicts),
            }
        },
    )


async def resolve_appeal(
    db: AsyncIOMotorDatabase,
    appeal_id: str,
    admin_user_id: str,
    action: str,
    admin_response: str = "",
) -> AppealResponse:
    """
    Admin accepts or rejects a pending appeal.

    Accept → override image verdict to Approved with audit metadata.
    Reject → appeal status only; verdict unchanged.
    """
    appeal = await get_appeal_by_id(db, appeal_id)
    if appeal is None:
        raise ValueError("Appeal not found")
    if appeal.status != AppealStatus.PENDING:
        raise ValueError("Only pending appeals can be resolved")

    now = datetime.utcnow()
    new_status = AppealStatus.ACCEPTED if action == "accepted" else AppealStatus.REJECTED

    if action == "accepted":
        await _apply_verdict_override(
            db,
            appeal.submission_id,
            appeal.image_id,
            appeal_id,
            admin_user_id,
        )

    await db[APPEALS_COLLECTION].update_one(
        {"_id": ObjectId(appeal_id)},
        {
            "$set": {
                "status": new_status.value,
                "admin_response": admin_response.strip(),
                "reviewed_by": admin_user_id,
                "reviewed_at": now,
            }
        },
    )

    updated = await get_appeal_by_id(db, appeal_id)
    assert updated is not None
    return updated
