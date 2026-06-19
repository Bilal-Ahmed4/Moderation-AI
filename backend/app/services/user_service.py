"""
User persistence layer — all MongoDB reads/writes for the users collection.

Keeps auth route handlers thin: routes validate input, this service talks to the DB.
"""

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.password import hash_password, verify_password
from app.config import get_settings
from app.models.user import UserCreate, UserInDB, UserResponse, UserRole


def _doc_to_user(doc: dict) -> UserInDB:
    """Convert a raw MongoDB document into a typed UserInDB model."""
    return UserInDB(
        id=str(doc["_id"]),
        email=doc["email"],
        password_hash=doc["password_hash"],
        full_name=doc.get("full_name", ""),
        role=UserRole(doc["role"]),
        created_at=doc.get("created_at", datetime.utcnow()),
    )


def user_to_response(user: UserInDB) -> UserResponse:
    """Strip sensitive fields before sending a user to the API client."""
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        created_at=user.created_at,
    )


async def ensure_user_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes once at startup. Email must be unique."""
    await db.users.create_index("email", unique=True)


async def get_user_by_email(db: AsyncIOMotorDatabase, email: str) -> UserInDB | None:
    """Look up a user by email. Returns None if not registered."""
    doc = await db.users.find_one({"email": email.lower()})
    if doc is None:
        return None
    return _doc_to_user(doc)


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> UserInDB | None:
    """Look up a user by MongoDB _id string. Returns None if missing or invalid id."""
    if not ObjectId.is_valid(user_id):
        return None
    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if doc is None:
        return None
    return _doc_to_user(doc)


def _resolve_role_for_new_user(email: str) -> UserRole:
    """
    Assign admin role when the email matches BOOTSTRAP_ADMIN_EMAIL.

    This lets you promote the first admin without a separate seed script.
    Leave BOOTSTRAP_ADMIN_EMAIL empty in production after setup.
    """
    settings = get_settings()
    bootstrap_email = settings.bootstrap_admin_email.strip().lower()
    if bootstrap_email and email.lower() == bootstrap_email:
        return UserRole.ADMIN
    return UserRole.USER


async def create_user(db: AsyncIOMotorDatabase, payload: UserCreate) -> UserInDB:
    """
    Register a new user.

    Raises ValueError if the email is already taken.
    """
    email = payload.email.lower()

    existing = await get_user_by_email(db, email)
    if existing is not None:
        raise ValueError("Email already registered")

    now = datetime.utcnow()
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name.strip(),
        "role": _resolve_role_for_new_user(email).value,
        "created_at": now,
    }

    result = await db.users.insert_one(doc)
    return UserInDB(
        id=str(result.inserted_id),
        email=email,
        password_hash=doc["password_hash"],
        full_name=doc["full_name"],
        role=UserRole(doc["role"]),
        created_at=now,
    )


async def authenticate_user(
    db: AsyncIOMotorDatabase,
    email: str,
    plain_password: str,
) -> UserInDB | None:
    """
    Verify email + password.

    Returns the user on success, None on wrong email or wrong password.
    We use the same None for both cases so attackers cannot enumerate emails.
    """
    user = await get_user_by_email(db, email)
    if user is None:
        return None
    if not verify_password(plain_password, user.password_hash):
        return None
    return user
