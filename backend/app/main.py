from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, consents, exercises, goals, history, progress, scans
from app.config import settings
from app.services.storage_service import storage_service

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 운동 데모 이미지(Free Exercise DB, CC0)는 공개 콘텐츠라 정적 서빙.
# 사용자 신체 사진(scans/)은 민감정보라 여기 포함하지 않고
# /scans/{id}/images/{image_id}/file 인증 엔드포인트로만 제공한다.
exercise_images_dir = storage_service.root / "exercise_images"
exercise_images_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media/exercise_images", StaticFiles(directory=str(exercise_images_dir)), name="exercise_images")

app.include_router(auth.router)
app.include_router(consents.router)
app.include_router(scans.router)
app.include_router(goals.router)
app.include_router(exercises.router)
app.include_router(progress.router)
app.include_router(history.router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok", "environment": settings.environment}
