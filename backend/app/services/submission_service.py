"""
Submission service — Phase 4 (MongoDB).

Persists submissions in the `submissions` collection. Each document holds
image file metadata, per-image verdicts, and denormalized fields for filtering.

MongoDB timeline in this project:
  Phase 1 → users
  Phase 2 → policy_versions + policy_state
  Phase 4 → submissions  ← you are here
  Phase 5 → appeals
  Phase 6 → analytics (aggregation only, no new collections)
"""

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.moderation_models import ClassificationResult, ImageVerdict
from app.models.submission import (
    StoredImage,
    SubmissionFilterParams,
    SubmissionListResponse,
    SubmissionResponse,
)
from app.services.file_storage import delete_submission_files
from app.services.policy_service import get_active_policy
from app.services.verdict_service import screen_image

SUBMISSIONS_COLLECTION = "submissions"


def _image_verdict_to_db(verdict: ImageVerdict) -> dict:
    return verdict.model_dump(mode="json")


def _image_verdict_from_db(data: dict) -> ImageVerdict:
    """Load verdict from MongoDB; backfill original_outcome for older documents."""
    if "original_overall_outcome" not in data:
        data = {
            **data,
            "original_overall_outcome": data.get("overall_outcome"),
        }
    return ImageVerdict(**data)


def _stored_image_to_db(image: StoredImage) -> dict:
    return image.model_dump()


def _stored_image_from_db(data: dict) -> StoredImage:
    return StoredImage(**data)


def _doc_to_submission(doc: dict) -> SubmissionResponse:
    return SubmissionResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        submitted_at=doc["submitted_at"],
        images=[_stored_image_from_db(item) for item in doc.get("images", [])],
        image_verdicts=[
            _image_verdict_from_db(item) for item in doc.get("image_verdicts", [])
        ],
    )


def _detected_categories_from_verdicts(verdicts: list[ImageVerdict]) -> list[str]:
    """Denormalized list for fast category filtering in MongoDB."""
    found: set[str] = set()
    for verdict in verdicts:
        for row in verdict.category_breakdown:
            if row.result == ClassificationResult.DETECTED:
                found.add(row.category.value)
    return sorted(found)


def _outcomes_from_verdicts(verdicts: list[ImageVerdict]) -> list[str]:
    """Denormalized per-image outcomes for fast outcome filtering."""
    return [verdict.overall_outcome.value for verdict in verdicts]


async def ensure_submission_indexes(db: AsyncIOMotorDatabase) -> None:
    """Indexes for user history and filter queries."""
    collection = db[SUBMISSIONS_COLLECTION]
    await collection.create_index([("user_id", 1), ("submitted_at", -1)])
    await collection.create_index("outcomes")
    await collection.create_index("detected_categories")


def _build_filter_query(user_id: str, filters: SubmissionFilterParams) -> dict:
    """Build a MongoDB query from history filter parameters."""
    query: dict = {"user_id": user_id}

    if filters.outcome is not None:
        query["outcomes"] = filters.outcome.value

    if filters.category is not None:
        query["detected_categories"] = filters.category.value

    if filters.date_from is not None or filters.date_to is not None:
        date_query: dict = {}
        if filters.date_from is not None:
            date_query["$gte"] = filters.date_from
        if filters.date_to is not None:
            date_query["$lte"] = filters.date_to
        query["submitted_at"] = date_query

    return query


async def create_submission(
    db: AsyncIOMotorDatabase,
    user_id: str,
    submission_id: str,
    images: list[StoredImage],
    image_paths: list[tuple[str, str]],
    policy,
) -> SubmissionResponse:
    """
    Screen each image and persist the submission document.

    image_paths: list of (image_id, absolute_file_path) pairs.
    """
    image_verdicts: list[ImageVerdict] = []

    for image_id, absolute_path in image_paths:
        verdict = await screen_image(absolute_path, image_id, policy)
        image_verdicts.append(verdict)

    now = datetime.utcnow()
    doc = {
        "user_id": user_id,
        "submitted_at": now,
        "images": [_stored_image_to_db(image) for image in images],
        "image_verdicts": [_image_verdict_to_db(verdict) for verdict in image_verdicts],
        "outcomes": _outcomes_from_verdicts(image_verdicts),
        "detected_categories": _detected_categories_from_verdicts(image_verdicts),
    }

    result = await db[SUBMISSIONS_COLLECTION].insert_one(
        {**doc, "_id": ObjectId(submission_id)}
    )
    doc["_id"] = result.inserted_id
    return _doc_to_submission(doc)


async def list_submissions(
    db: AsyncIOMotorDatabase,
    user_id: str,
    filters: SubmissionFilterParams,
) -> SubmissionListResponse:
    """Return the current user's submission history with optional filters."""
    query = _build_filter_query(user_id, filters)
    collection = db[SUBMISSIONS_COLLECTION]

    total = await collection.count_documents(query)
    cursor = (
        collection.find(query)
        .sort("submitted_at", -1)
        .skip(filters.skip)
        .limit(filters.limit)
    )
    items = [_doc_to_submission(doc) async for doc in cursor]

    return SubmissionListResponse(
        items=items,
        total=total,
        limit=filters.limit,
        skip=filters.skip,
    )


async def get_submission_by_id(
    db: AsyncIOMotorDatabase,
    submission_id: str,
    user_id: str,
) -> SubmissionResponse | None:
    """Fetch one submission; returns None if not found or not owned by user."""
    if not ObjectId.is_valid(submission_id):
        return None

    doc = await db[SUBMISSIONS_COLLECTION].find_one(
        {"_id": ObjectId(submission_id), "user_id": user_id}
    )
    if doc is None:
        return None
    return _doc_to_submission(doc)


async def get_active_policy_or_raise(db: AsyncIOMotorDatabase):
    """Load active policy; callers translate None to HTTP 503."""
    return await get_active_policy(db)


async def get_submission_by_id_admin(
    db: AsyncIOMotorDatabase,
    submission_id: str,
) -> SubmissionResponse | None:
    """
    Fetch any submission by id with no user_id filter.
    Only call this from admin-gated routes.
    """
    if not ObjectId.is_valid(submission_id):
        return None
    doc = await db[SUBMISSIONS_COLLECTION].find_one({"_id": ObjectId(submission_id)})
    if doc is None:
        return None
    return _doc_to_submission(doc)
