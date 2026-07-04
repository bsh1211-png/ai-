from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import ADULT_AGE, CURRENT_POLICY_VERSION, MIN_SIGNUP_AGE
from app.models.user import GuardianConsentStatus, OAuthProvider, PolicyConsent, PolicyType, User


def age_from_birth_date(birth_date: date) -> int:
    today = datetime.now(timezone.utc).date()
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


def create_user_and_consents(
    db: Session,
    *,
    email: str,
    birth_date: date,
    accept_terms: bool,
    accept_privacy: bool,
    accept_marketing: bool,
    oauth_provider: OAuthProvider | None = None,
    oauth_id: str | None = None,
) -> User:
    """Google OAuth 가입 공통 로직: 동의 검증, 나이 검증, User + 동의 레코드 생성."""
    if not accept_terms or not accept_privacy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이용약관 및 개인정보 수집·이용 동의는 필수입니다",
        )

    age = age_from_birth_date(birth_date)
    if age < MIN_SIGNUP_AGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"만 {MIN_SIGNUP_AGE}세 미만은 가입할 수 없습니다",
        )

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 가입된 이메일입니다")

    # 법정대리인 동의 절차는 제거됨. 나이는 통계/표시용으로만 기록한다.
    is_minor = age < ADULT_AGE

    user = User(
        email=email,
        oauth_provider=oauth_provider,
        oauth_id=oauth_id,
        birth_date=birth_date,
        is_minor=is_minor,
        guardian_consent_status=GuardianConsentStatus.na,
        guardian_email=None,
    )
    db.add(user)
    db.flush()

    now = datetime.now(timezone.utc)
    db.add_all(
        [
            PolicyConsent(
                user_id=user.id,
                policy_type=PolicyType.terms_of_service,
                policy_version=CURRENT_POLICY_VERSION,
                consented=True,
                consented_at=now,
            ),
            PolicyConsent(
                user_id=user.id,
                policy_type=PolicyType.privacy_policy,
                policy_version=CURRENT_POLICY_VERSION,
                consented=True,
                consented_at=now,
            ),
            PolicyConsent(
                user_id=user.id,
                policy_type=PolicyType.marketing_optional,
                policy_version=CURRENT_POLICY_VERSION,
                consented=accept_marketing,
                consented_at=now,
            ),
        ]
    )
    db.commit()
    return user
