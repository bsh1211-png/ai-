import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin


class GuardianConsentStatus(str, enum.Enum):
    na = "na"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class User(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    birth_date: Mapped[date] = mapped_column(Date)
    is_minor: Mapped[bool] = mapped_column(Boolean, default=False)
    guardian_consent_status: Mapped[GuardianConsentStatus] = mapped_column(
        Enum(GuardianConsentStatus), default=GuardianConsentStatus.na
    )
    guardian_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guardian_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_retention_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    policy_consents: Mapped[list["PolicyConsent"]] = relationship(back_populates="user")
    body_image_consents: Mapped[list["BodyImageConsent"]] = relationship(back_populates="user")


class PolicyType(str, enum.Enum):
    terms_of_service = "terms_of_service"
    privacy_policy = "privacy_policy"
    marketing_optional = "marketing_optional"


class PolicyConsent(UUIDPKMixin, Base):
    __tablename__ = "policy_consents"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    policy_type: Mapped[PolicyType] = mapped_column(Enum(PolicyType))
    policy_version: Mapped[str] = mapped_column(String(50))
    consented: Mapped[bool] = mapped_column(Boolean, default=True)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)

    user: Mapped["User"] = relationship(back_populates="policy_consents")


class BodyImageConsentType(str, enum.Enum):
    camera_and_body_image = "camera_and_body_image"
    analysis = "analysis"
    storage = "storage"


class BodyImageConsent(UUIDPKMixin, Base):
    __tablename__ = "body_image_consents"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    consent_type: Mapped[BodyImageConsentType] = mapped_column(Enum(BodyImageConsentType))
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    policy_version: Mapped[str] = mapped_column(String(50))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="body_image_consents")
