import uuid
from datetime import datetime

from pydantic import BaseModel


class ProgressLogCreateRequest(BaseModel):
    weight_kg: float | None = None
    body_fat_pct: float | None = None
    notes: str | None = None


class ProgressLogResponse(BaseModel):
    id: uuid.UUID
    weight_kg: float | None
    body_fat_pct: float | None
    notes: str | None
    logged_at: datetime

    class Config:
        from_attributes = True
