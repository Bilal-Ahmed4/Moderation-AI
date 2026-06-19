from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # Accept MONGODB_URL (local/Docker) or MONGODB_URI (Atlas mongodb+srv://...)
    mongodb_url: str = Field(
        default="mongodb://mongo:27017",
        validation_alias=AliasChoices("MONGODB_URL", "MONGODB_URI", "mongodb_url"),
    )
    mongodb_db: str = "moderation_platform"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    google_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"

    # Optional: first registration with this email gets role=admin (leave empty after setup).
    bootstrap_admin_email: str = ""

    # Uploaded submission images (Cloudinary URLs stored in MongoDB).
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 10

    # Cloudinary (image hosting)
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
