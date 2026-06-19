"""
File storage for uploaded submission images.

Images are saved to disk under uploads/{user_id}/{submission_id}/.
MongoDB stores the relative path; this keeps screening simple for Gemini
(which reads a local file path).
"""

import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import get_settings

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

# Map MIME type → file extension for saved files.
EXTENSION_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def get_upload_root() -> Path:
    """Return the configured upload directory, creating it if needed."""
    root = Path(get_settings().upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def validate_image_file(file: UploadFile) -> None:
    """Reject unsupported or empty uploads before saving."""
    if not file.content_type or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(
            f"Unsupported file type: {file.content_type or 'unknown'}. "
            f"Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}"
        )
    if not file.filename:
        raise ValueError("Each uploaded file must have a filename")


async def save_submission_image(
    file: UploadFile,
    user_id: str,
    submission_id: str,
) -> tuple[str, Path, str]:
    """
    Save one uploaded image to disk.

    Returns (image_id, absolute_path, relative_storage_path).
    """
    validate_image_file(file)

    image_id = str(uuid.uuid4())
    extension = EXTENSION_BY_TYPE[file.content_type]
    relative_dir = Path(user_id) / submission_id
    filename = f"{image_id}{extension}"

    absolute_dir = get_upload_root() / relative_dir
    absolute_dir.mkdir(parents=True, exist_ok=True)

    absolute_path = absolute_dir / filename
    relative_path = str(relative_dir / filename)

    content = await file.read()
    max_bytes = get_settings().max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise ValueError(
            f"File '{file.filename}' exceeds {get_settings().max_upload_size_mb} MB limit"
        )
    if len(content) == 0:
        raise ValueError(f"File '{file.filename}' is empty")

    absolute_path.write_bytes(content)
    return image_id, absolute_path, relative_path


def resolve_storage_path(relative_path: str) -> Path:
    """Turn a stored relative path into an absolute path for reading."""
    return get_upload_root() / relative_path


def delete_submission_files(user_id: str, submission_id: str) -> None:
    """Remove all files for a submission (used when screening fails mid-upload)."""
    target_dir = get_upload_root() / user_id / submission_id
    if not target_dir.exists():
        return
    for file_path in target_dir.iterdir():
        if file_path.is_file():
            file_path.unlink()
    target_dir.rmdir()
