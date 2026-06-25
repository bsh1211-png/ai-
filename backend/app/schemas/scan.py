import uuid
from datetime import datetime

from pydantic import BaseModel


class ScanSessionCreateRequest(BaseModel):
    category: str


class ScanImageResponse(BaseModel):
    id: uuid.UUID
    angle: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ScanSessionResponse(BaseModel):
    id: uuid.UUID
    category: str
    status: str
    scan_date: datetime
    error_message: str | None
    images: list[ScanImageResponse] = []

    class Config:
        from_attributes = True


class AnalysisReportResponse(BaseModel):
    id: uuid.UUID
    summary: str
    weak_points: list
    recommended_exercise_ids: list
    goal_comparison: dict | None
    headline_stats: dict | None
    recommended_routine: dict | None
    created_at: datetime

    class Config:
        from_attributes = True
