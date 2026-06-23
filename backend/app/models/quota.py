import enum

from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin


class QuotaEventType(str, enum.Enum):
    rate_limit = "rate_limit"
    daily_quota_exceeded = "daily_quota_exceeded"


class ApiQuotaEvent(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "api_quota_events"

    provider: Mapped[str] = mapped_column(String(50), default="gemini")
    model: Mapped[str] = mapped_column(String(100))
    event_type: Mapped[QuotaEventType] = mapped_column(Enum(QuotaEventType))
