import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.mixins import UUIDPKMixin


class ExerciseSource(str, enum.Enum):
    free_exercise_db = "free_exercise_db"
    ai_generated = "ai_generated"
    curated = "curated"


class Exercise(UUIDPKMixin, Base):
    __tablename__ = "exercises"

    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    name_en: Mapped[str] = mapped_column(String(255))
    name_ko: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    primary_muscles: Mapped[list] = mapped_column(JSON, default=list)
    secondary_muscles: Mapped[list] = mapped_column(JSON, default=list)
    equipment: Mapped[str | None] = mapped_column(String(100), nullable=True)
    level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    image_paths: Mapped[list] = mapped_column(JSON, default=list)
    youtube_video_ids: Mapped[list] = mapped_column(JSON, default=list)
    youtube_channel_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[ExerciseSource] = mapped_column(Enum(ExerciseSource), default=ExerciseSource.free_exercise_db)


class Routine(UUIDPKMixin, Base):
    __tablename__ = "routines"

    name: Mapped[str] = mapped_column(String(255))
    target_body_parts: Mapped[list] = mapped_column(JSON, default=list)
    goal_tags: Mapped[list] = mapped_column(JSON, default=list)
    difficulty: Mapped[str | None] = mapped_column(String(50), nullable=True)
    exercise_sequence: Mapped[list] = mapped_column(JSON, default=list)


class RoutineAssignmentStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    skipped = "skipped"


class UserRoutineAssignment(UUIDPKMixin, Base):
    __tablename__ = "user_routine_assignments"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    routine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("routines.id"))
    report_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("analysis_reports.id"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[RoutineAssignmentStatus] = mapped_column(
        Enum(RoutineAssignmentStatus), default=RoutineAssignmentStatus.active
    )
