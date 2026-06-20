"""
Submission routes — Phase 4 + Cloudinary storage.

Users upload images → screen with Gemini → store Cloudinary URL in MongoDB.
"""

import tempfile
from datetime import datetime
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse

from app.auth.dependencies import get_current_user, get_image_viewer, require_admin
from app.database import get_database
from app.models.moderation_models import ModerationCategory, OverallOutcome
from app.models.submission import (
    StoredImage,
    SubmissionFilterParams,
    SubmissionListResponse,
    SubmissionResponse,
)
from app.models.user import UserResponse, UserRole
from app.services.cloudinary_storage import (
    delete_cloudinary_images,
    new_image_id,
    read_image_bytes,
    upload_image_bytes,
)
from app.services.file_storage import resolve_storage_path
from app.services.submission_service import (
    create_submission,
    get_active_policy_or_raise,
    get_submission_by_id,
    get_submission_by_id_admin,
    list_submissions,
)

router = APIRouter()


@router.post(
    "/", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED
)
async def upload_submission(
    files: list[UploadFile] = File(..., description="One or more images to screen"),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Submit one or more images for AI moderation.

    1. Screen each image with Gemini (via temp file)
    2. Upload to Cloudinary
    3. Save secure URL + verdicts in MongoDB
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one image file is required",
        )

    db = get_database()
    policy = await get_active_policy_or_raise(db)
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No active moderation policy configured",
        )

    submission_id = str(ObjectId())
    stored_images: list[StoredImage] = []
    image_paths: list[tuple[str, str]] = []
    uploaded_public_ids: list[str] = []
    temp_files: list[Path] = []

    try:
        for upload in files:
            try:
                content, content_type, filename = await read_image_bytes(upload)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                ) from exc

            image_id = new_image_id()

            # Gemini screens from a short-lived temp file.
            suffix = Path(filename).suffix or ".jpg"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            tmp.write(content)
            tmp.flush()
            tmp.close()
            temp_path = Path(tmp.name)
            temp_files.append(temp_path)
            image_paths.append((image_id, str(temp_path)))

            # Upload to Cloudinary after we have bytes ready.
            try:
                image_url, public_id = await upload_image_bytes(
                    content,
                    user_id=current_user.id,
                    submission_id=submission_id,
                    image_id=image_id,
                )
            except RuntimeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=str(exc),
                ) from exc

            uploaded_public_ids.append(public_id)
            stored_images.append(
                StoredImage(
                    image_id=image_id,
                    original_filename=filename,
                    content_type=content_type,
                    image_url=image_url,
                    cloudinary_public_id=public_id,
                )
            )

        return await create_submission(
            db,
            current_user.id,
            submission_id,
            stored_images,
            image_paths,
            policy,
        )

    except HTTPException:
        await delete_cloudinary_images(uploaded_public_ids)
        raise
    except Exception as exc:
        await delete_cloudinary_images(uploaded_public_ids)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Submission failed: {exc}",
        ) from exc
    finally:
        for temp_path in temp_files:
            if temp_path.exists():
                temp_path.unlink()


@router.get("/", response_model=SubmissionListResponse)
async def get_submission_history(
    current_user: UserResponse = Depends(get_current_user),
    outcome: OverallOutcome | None = Query(
        default=None, description="Filter by image outcome"
    ),
    category: ModerationCategory | None = Query(
        default=None, description="Filter by detected category"
    ),
    date_from: datetime | None = Query(
        default=None, description="Submitted on or after (ISO datetime)"
    ),
    date_to: datetime | None = Query(
        default=None, description="Submitted on or before (ISO datetime)"
    ),
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    """List the current user's submissions with optional filters."""
    db = get_database()
    filters = SubmissionFilterParams(
        outcome=outcome,
        category=category,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        skip=skip,
    )
    return await list_submissions(db, current_user.id, filters)


@router.get("/admin/{submission_id}", response_model=SubmissionResponse)
async def get_submission_admin(
    submission_id: str,
    current_user: UserResponse = Depends(require_admin),
):
    """
    Admin-only: fetch any submission regardless of who submitted it.

    The normal /{submission_id} endpoint is owner-only, which means an admin
    clicking a submission link from the appeal queue would get a 404 even
    though the submission exists. This endpoint fixes that.
    """
    db = get_database()
    submission = await get_submission_by_id_admin(db, submission_id)
    if submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    return submission


@router.get("/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get one submission by id. Admins can view any submission; regular users
    can only view their own."""
    db = get_database()
    # Admins need cross-user access (e.g. reviewing an appeal's linked
    # submission). Regular users remain owner-only.
    if current_user.role == UserRole.ADMIN:
        submission = await get_submission_by_id_admin(db, submission_id)
    else:
        submission = await get_submission_by_id(db, submission_id, current_user.id)
    if submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    return submission


@router.get("/{submission_id}/images/{image_id}")
async def get_submission_image(
    submission_id: str,
    image_id: str,
    current_user: UserResponse = Depends(get_image_viewer),
):
    """
    Image endpoint — redirects to the Cloudinary URL if one is stored,
    otherwise serves the file from disk (legacy/fallback path).

    Uses get_image_viewer instead of get_current_user because <img> tags
    can't send Authorization headers; the token comes as a query param.
    """
    db = get_database()
    submission = await get_submission_by_id(db, submission_id, current_user.id)
    if submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found"
        )

    image = next((img for img in submission.images if img.image_id == image_id), None)
    if image is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Image not found"
        )

    if image.image_url:
        return RedirectResponse(url=image.image_url, status_code=307)

    if image.storage_path:
        file_path = resolve_storage_path(image.storage_path)
        if file_path.exists():
            return FileResponse(
                file_path,
                media_type=image.content_type,
                filename=image.original_filename,
            )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found"
    )
