"""
Policy service — versioned moderation policy management.

Collections:
  policy_versions  — immutable snapshots (never updated after insert)
  policy_state     — singleton doc pointing at the active version _id

On first startup we seed version 1 with sensible defaults so submissions
(Phase 4) always have an active policy to screen against.
"""

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.moderation_models import EnforcementAction, ModerationCategory
from app.models.policy import CategoryPolicy, PolicyUpdateRequest, PolicyVersion

# Fixed key for the singleton active-policy pointer document.
_POLICY_STATE_KEY = "active"

# MongoDB collection names.
VERSIONS_COLLECTION = "policy_versions"
STATE_COLLECTION = "policy_state"


def _default_categories() -> list[CategoryPolicy]:
    """Sensible defaults for the first seeded policy version."""
    return [
        CategoryPolicy(
            category=cat,
            enabled=True,
            threshold=75.0,
            enforcement=EnforcementAction.FLAG_FOR_REVIEW,
        )
        for cat in ModerationCategory
    ]


def _doc_to_policy_version(doc: dict) -> PolicyVersion:
    """Convert a MongoDB policy_versions document to a PolicyVersion model."""
    categories = [CategoryPolicy(**item) for item in doc["categories"]]
    return PolicyVersion(
        id=str(doc["_id"]),
        version=doc["version"],
        categories=categories,
        created_at=doc.get("created_at", datetime.utcnow()),
        created_by=doc.get("created_by", "system"),
    )


def _categories_to_db(categories: list[CategoryPolicy]) -> list[dict]:
    """Serialize category policies for MongoDB storage."""
    return [item.model_dump(mode="json") for item in categories]


async def ensure_policy_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes used by policy queries."""
    await db[VERSIONS_COLLECTION].create_index("version", unique=True)
    await db[STATE_COLLECTION].create_index("key", unique=True)


async def _get_active_version_id(db: AsyncIOMotorDatabase) -> str | None:
    """Read the active policy version id from the singleton state document."""
    state = await db[STATE_COLLECTION].find_one({"key": _POLICY_STATE_KEY})
    if state is None or state.get("active_version_id") is None:
        return None
    return str(state["active_version_id"])


async def _set_active_version_id(db: AsyncIOMotorDatabase, version_id: str) -> None:
    """Point policy_state at a new active version (used after each admin save)."""
    await db[STATE_COLLECTION].update_one(
        {"key": _POLICY_STATE_KEY},
        {
            "$set": {
                "active_version_id": ObjectId(version_id),
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )


async def get_policy_version_by_id(
    db: AsyncIOMotorDatabase,
    version_id: str,
) -> PolicyVersion | None:
    """Fetch a specific policy version by its MongoDB _id (for verdict audit trails)."""
    if not ObjectId.is_valid(version_id):
        return None
    doc = await db[VERSIONS_COLLECTION].find_one({"_id": ObjectId(version_id)})
    if doc is None:
        return None
    return _doc_to_policy_version(doc)


async def get_active_policy(db: AsyncIOMotorDatabase) -> PolicyVersion | None:
    """
    Return the currently active policy version.

    Called internally by submission/verdict services — not only by admin routes.
    """
    active_id = await _get_active_version_id(db)
    if active_id is None:
        return None
    return await get_policy_version_by_id(db, active_id)


async def list_policy_versions(
    db: AsyncIOMotorDatabase,
    *,
    limit: int = 50,
    skip: int = 0,
) -> tuple[list[PolicyVersion], int, str | None]:
    """
    List policy versions newest-first.

    Returns (items, total_count, active_version_id).
    """
    active_id = await _get_active_version_id(db)
    total = await db[VERSIONS_COLLECTION].count_documents({})

    cursor = (
        db[VERSIONS_COLLECTION]
        .find()
        .sort("version", -1)
        .skip(skip)
        .limit(limit)
    )
    items = [_doc_to_policy_version(doc) async for doc in cursor]
    return items, total, active_id


async def seed_default_policy_if_needed(db: AsyncIOMotorDatabase) -> PolicyVersion | None:
    """
    Create version 1 with defaults if no policy exists yet.

    Runs at application startup so screening never runs without a policy.
    """
    existing = await db[VERSIONS_COLLECTION].find_one({})
    if existing is not None:
        return None

    now = datetime.utcnow()
    categories = _default_categories()
    doc = {
        "version": 1,
        "categories": _categories_to_db(categories),
        "created_at": now,
        "created_by": "system",
    }
    result = await db[VERSIONS_COLLECTION].insert_one(doc)
    version_id = str(result.inserted_id)
    await _set_active_version_id(db, version_id)

    return PolicyVersion(
        id=version_id,
        version=1,
        categories=categories,
        created_at=now,
        created_by="system",
    )


async def create_policy_version(
    db: AsyncIOMotorDatabase,
    payload: PolicyUpdateRequest,
    admin_user_id: str,
) -> PolicyVersion:
    """
    Save a new immutable policy version and make it the active one.

    Previous versions are never modified — verdicts from old submissions
    keep referencing their original policy_version_id.
    """
    latest = await db[VERSIONS_COLLECTION].find_one(sort=[("version", -1)])
    next_version = 1 if latest is None else latest["version"] + 1

    now = datetime.utcnow()
    doc = {
        "version": next_version,
        "categories": _categories_to_db(payload.categories),
        "created_at": now,
        "created_by": admin_user_id,
    }
    result = await db[VERSIONS_COLLECTION].insert_one(doc)
    version_id = str(result.inserted_id)
    await _set_active_version_id(db, version_id)

    return PolicyVersion(
        id=version_id,
        version=next_version,
        categories=payload.categories,
        created_at=now,
        created_by=admin_user_id,
    )


def get_enabled_categories(policy: PolicyVersion) -> list[CategoryPolicy]:
    """
    Return only enabled categories from a policy version.

    Used by AI moderation (Phase 3) to know which categories to screen.
    """
    return [cat for cat in policy.categories if cat.enabled]
