from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import BodyImageConsent, BodyImageConsentType, GuardianConsentStatus, User


def active_body_image_consent(db: Session, user: User) -> BodyImageConsent | None:
    stmt = (
        select(BodyImageConsent)
        .where(
            BodyImageConsent.user_id == user.id,
            BodyImageConsent.consent_type == BodyImageConsentType.camera_and_body_image,
            BodyImageConsent.revoked_at.is_(None),
        )
        .order_by(BodyImageConsent.consented_at.desc())
    )
    return db.execute(stmt).scalars().first()


def upload_block_reason(db: Session, user: User) -> str | None:
    """업로드 차단 이유를 반환. 차단이 없으면 None."""
    consent = active_body_image_consent(db, user)
    if consent is None:
        return "카메라/신체사진 사용 동의가 필요합니다"
    if user.is_minor and user.guardian_consent_status != GuardianConsentStatus.approved:
        return "법정대리인 동의가 완료되어야 업로드할 수 있습니다"
    return None
