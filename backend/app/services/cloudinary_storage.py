"""
Cloudinary image storage — uploads submission images to the cloud.

MongoDB stores the secure URL; Gemini still screens from a local temp file
during upload (then the temp file is deleted).
"""

import asyncio
import uuid
from typing import BinaryIO

import cloudinary
import cloudinary.uploader
from fastapi import UploadFile

from app.config import get_settings

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


def _configure_cloudinary() -> None:
    settings = get_settings()
    if not all([
        settings.cloudinary_cloud_name,
        settings.cloudinary_api_key,
        settings.cloudinary_api_secret,
    ]):
        raise RuntimeError(
            "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env"
        )
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


def validate_image_file(file: UploadFile) -> None:
    if not file.content_type or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(
            f"Unsupported file type: {file.content_type or 'unknown'}. "
            f"Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}"
        )
    if not file.filename:
        raise ValueError("Each uploaded file must have a filename")


async def read_image_bytes(file: UploadFile) -> tuple[bytes, str, str]:
    """Validate upload and return (bytes, content_type, original_filename)."""
    validate_image_file(file)
    content = await file.read()
    max_bytes = get_settings().max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise ValueError(
            f"File '{file.filename}' exceeds {get_settings().max_upload_size_mb} MB limit"
        )
    if len(content) == 0:
        raise ValueError(f"File '{file.filename}' is empty")
    return content, file.content_type or "image/jpeg", file.filename or "image"


def new_image_id() -> str:
    return str(uuid.uuid4())


def _upload_sync(content: bytes, folder: str, image_id: str) -> dict:
    _configure_cloudinary()
    return cloudinary.uploader.upload(
        content,
        folder=folder,
        public_id=image_id,
        resource_type="image",
        overwrite=True,
    )


async def upload_image_bytes(
    content: bytes,
    *,
    user_id: str,
    submission_id: str,
    image_id: str,
) -> tuple[str, str]:
    """
    Upload image bytes to Cloudinary.

    Returns (secure_url, public_id).
    """
    folder = f"moderation/{user_id}/{submission_id}"
    result = await asyncio.to_thread(_upload_sync, content, folder, image_id)
    return result["secure_url"], result["public_id"]


def _destroy_sync(public_id: str) -> None:
    _configure_cloudinary()
    try:
        cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception:
        pass  # best-effort cleanup on rollback


async def delete_cloudinary_image(public_id: str) -> None:
    """Remove one image from Cloudinary (used when submission fails mid-upload)."""
    if not public_id:
        return
    await asyncio.to_thread(_destroy_sync, public_id)


async def delete_cloudinary_images(public_ids: list[str]) -> None:
    for public_id in public_ids:
        await delete_cloudinary_image(public_id)
