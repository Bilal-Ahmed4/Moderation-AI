"""
Authentication routes — Phase 1.

POST /register  — create account, return JWT
POST /login     — verify credentials, return JWT
GET  /me        — return the currently logged-in user (requires Bearer token)
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.auth.jwt_handler import create_access_token
from app.database import get_database
from app.models.user import AuthResponse, UserCreate, UserLogin, UserResponse
from app.services.user_service import (
    authenticate_user,
    create_user,
    user_to_response,
)

router = APIRouter()


def _build_auth_response(user) -> AuthResponse:
    """Package a JWT and user profile into the standard auth response."""
    token = create_access_token(
        {
            "sub": user.id,
            "email": user.email,
            "role": user.role.value,
        }
    )
    return AuthResponse(
        access_token=token,
        user=user_to_response(user),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate):
    """
    Register a new account.

    - Email must be unique.
    - Password must be at least 8 characters.
    - Role defaults to "user"; set BOOTSTRAP_ADMIN_EMAIL in .env to auto-promote one admin.
    """
    db = get_database()

    try:
        user = await create_user(db, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return _build_auth_response(user)


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    """Log in with email and password. Returns a JWT on success."""
    db = get_database()
    user = await authenticate_user(db, payload.email, payload.password)

    if user is None:
        # Generic message — do not reveal whether the email exists.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return _build_auth_response(user)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    """Return the profile of the user attached to the Bearer token."""
    return current_user
