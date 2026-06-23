from fastapi import FastAPI

from app.api import auth, consents, exercises, goals, progress, scans
from app.config import settings

app = FastAPI(title=settings.app_name)

app.include_router(auth.router)
app.include_router(consents.router)
app.include_router(scans.router)
app.include_router(goals.router)
app.include_router(exercises.router)
app.include_router(progress.router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok", "environment": settings.environment}
