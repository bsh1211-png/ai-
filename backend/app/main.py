from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, consents, exercises, goals, history, oauth, progress, scans
from app.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 운동 데모 이미지(CC0)는 로컬 스태틱 서빙 (Supabase Storage 미사용).
# 사용자 신체 사진은 /scans/{id}/images/{image_id}/file 인증 엔드포인트로만 제공.
_EXERCISE_IMAGES_DIR = Path(__file__).resolve().parents[2] / "storage" / "exercise_images"
_EXERCISE_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    "/media/exercise_images",
    StaticFiles(directory=str(_EXERCISE_IMAGES_DIR)),
    name="exercise_images",
)

app.include_router(auth.router)
app.include_router(oauth.router)
app.include_router(consents.router)
app.include_router(scans.router)
app.include_router(goals.router)
app.include_router(exercises.router)
app.include_router(progress.router)
app.include_router(history.router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok", "environment": settings.environment}
