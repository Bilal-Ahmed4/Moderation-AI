from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import close_mongo_connection, connect_to_mongo, get_database
from app.routers import analytics, appeals, auth, policies, submissions
from app.services.appeal_service import ensure_appeal_indexes
from app.services.policy_service import ensure_policy_indexes, seed_default_policy_if_needed
from app.services.submission_service import ensure_submission_indexes
from app.services.user_service import ensure_user_indexes
from app.services.file_storage import get_upload_root


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    db = get_database()
    get_upload_root()  # ensure upload directory exists
    await ensure_user_indexes(db)
    await ensure_policy_indexes(db)
    await ensure_submission_indexes(db)
    await ensure_appeal_indexes(db)
    await seed_default_policy_if_needed(db)
    yield
    await close_mongo_connection()


settings = get_settings()

app = FastAPI(
    title="AI Content Moderation Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["submissions"])
app.include_router(appeals.router, prefix="/api/appeals", tags=["appeals"])
app.include_router(policies.router, prefix="/api/policies", tags=["policies"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "backend"}
