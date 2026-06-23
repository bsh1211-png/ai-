import uuid
from datetime import datetime

from pydantic import BaseModel


class GoalCreateRequest(BaseModel):
    goal_text: str


class GoalResponse(BaseModel):
    id: uuid.UUID
    goal_type: str
    goal_text: str | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
