import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.mixins import UUIDPKMixin


class ProgressLog(UUIDPKMixin, Base):
    __tablename__ = "progress_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    scan_session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("body_scan_sessions.id"), nullable=True
    )
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    body_fat_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
