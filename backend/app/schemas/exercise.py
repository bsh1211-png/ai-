import uuid

from pydantic import BaseModel


class ExerciseResponse(BaseModel):
    id: uuid.UUID
    name_en: str
    name_ko: str | None
    category: str | None
    primary_muscles: list
    secondary_muscles: list
    equipment: str | None
    level: str | None
    image_paths: list
    youtube_video_id: str | None

    class Config:
        from_attributes = True
