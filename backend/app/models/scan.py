import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin


class ScanCategory(str, enum.Enum):
    full_360 = "full_360"
    upper_front = "upper_front"
    upper_back = "upper_back"
    lower = "lower"
    custom = "custom"


class ScanStatus(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class BodyScanSession(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "body_scan_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    scan_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    category: Mapped[ScanCategory] = mapped_column(Enum(ScanCategory))
    status: Mapped[ScanStatus] = mapped_column(Enum(ScanStatus), default=ScanStatus.uploaded)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    images: Mapped[list["BodyScanImage"]] = relationship(back_populates="session")


class ImageAngle(str, enum.Enum):
    front = "front"
    back = "back"
    side = "side"
    upper = "upper"
    lower = "lower"


class BodyScanImage(UUIDPKMixin, Base):
    __tablename__ = "body_scan_images"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("body_scan_sessions.id"))
    angle: Mapped[ImageAngle] = mapped_column(Enum(ImageAngle))
    storage_path: Mapped[str] = mapped_column(String(500))
    thumbnail_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["BodyScanSession"] = relationship(back_populates="images")
    pose_metric: Mapped["PoseMetric | None"] = relationship(back_populates="scan_image")


class PoseMetric(UUIDPKMixin, Base):
    __tablename__ = "pose_metrics"

    scan_image_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("body_scan_images.id"))
    landmarks_json: Mapped[dict] = mapped_column(JSON)
    shoulder_width_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    waist_hip_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    limb_symmetry_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    posture_flags: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    scan_image: Mapped["BodyScanImage"] = relationship(back_populates="pose_metric")


class VisionAnalysis(UUIDPKMixin, Base):
    __tablename__ = "vision_analysis"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("body_scan_sessions.id"))
    model_version: Mapped[str] = mapped_column(String(100))
    body_part_assessment: Mapped[dict] = mapped_column(JSON)
    overall_comment: Mapped[str] = mapped_column(Text)
    disclaimer_shown: Mapped[bool] = mapped_column(Boolean, default=True)
    raw_response: Mapped[dict] = mapped_column(JSON)


class AnalysisReport(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "analysis_reports"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("body_scan_sessions.id"))
    summary: Mapped[str] = mapped_column(Text)
    weak_points: Mapped[list] = mapped_column(JSON)
    recommended_exercise_ids: Mapped[list] = mapped_column(JSON)
    goal_comparison: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class GoalType(str, enum.Enum):
    text = "text"
    reference_image = "reference_image"


class BodyGoal(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "body_goals"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    goal_type: Mapped[GoalType] = mapped_column(Enum(GoalType))
    goal_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_body_parts: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
