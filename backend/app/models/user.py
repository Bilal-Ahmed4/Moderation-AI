"""
User models for registration, login, and API responses.

Every user has a role: "user" (default) or "admin".
Admins unlock appeals queue, policy config, and analytics routes.
"""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


# Type alias used in dependencies and services for clarity.
RoleLiteral = Literal["user", "admin"]


class UserCreate(BaseModel):
    """Payload for POST /api/auth/register."""

    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 characters")
    full_name: str = ""


class UserLogin(BaseModel):
    """Payload for POST /api/auth/login."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Safe user shape returned to the client (no password)."""

    id: str
    email: EmailStr
    full_name: str = ""
    role: UserRole = UserRole.USER
    created_at: datetime


class UserInDB(BaseModel):
    """
    Full user document as stored in MongoDB.

    password_hash is never sent to the client.
    """

    id: str
    email: EmailStr
    password_hash: str
    full_name: str = ""
    role: UserRole = UserRole.USER
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TokenResponse(BaseModel):
    """JWT returned after successful login or registration."""

    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    """Login/register response: token plus the authenticated user profile."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
