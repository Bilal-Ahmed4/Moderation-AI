"""
Password hashing helpers.

We never store plain-text passwords — only bcrypt hashes.
"""

import bcrypt


def hash_password(plain_password: str) -> str:
    """Turn a plain password into a bcrypt hash for database storage."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Return True if the plain password matches the stored hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )
