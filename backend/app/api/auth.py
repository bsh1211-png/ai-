from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.constants import ADULT_AGE, CURRENT_POLICY_VERSION, MIN_SIGNUP_AGE
from app.core.security import create_access_token, create_guardian_consent_token, hash_password, verify_password
from app.db import get_db
from app.models.user import GuardianConsentStatus, PolicyConsent, PolicyType, User
from app.schemas.auth import LoginRequest, SignupRequest, SignupResponse, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


def _age(birth_date: date) -> int:
    today = datetime.now(timezone.utc).date()
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> SignupResponse:
    if not payload.accept_terms or not payload.accept_privacy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이용약관 및 개인정보 수집·이용 동의는 필수입니다",
        )

    age = _age(payload.birth_date)
    if age < MIN_SIGNUP_AGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"만 {MIN_SIGNUP_AGE}세 미만은 가입할 수 없습니다",
        )

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 가입된 이메일입니다")

    is_minor = age < ADULT_AGE
    if is_minor and not payload.guardian_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="미성년자는 법정대리인 이메일이 필요합니다",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        birth_date=payload.birth_date,
        is_minor=is_minor,
        guardian_consent_status=GuardianConsentStatus.pending if is_minor else GuardianConsentStatus.na,
        guardian_email=payload.guardian_email if is_minor else None,
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
                consented=payload.accept_marketing,
                consented_at=now,
            ),
        ]
    )
    db.commit()

    # 실제 메일 발송 인프라가 붙기 전까지, 개발 환경에서만 토큰을 응답에 노출해 동의 플로우를 직접 테스트할 수 있게 함.
    guardian_token = None
    if is_minor and settings.environment == "development":
        guardian_token = create_guardian_consent_token(user.id)

    return SignupResponse(
        access_token=create_access_token(user.id),
        is_minor=is_minor,
        guardian_consent_dev_token=guardian_token,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이메일 또는 비밀번호가 올바르지 않습니다")
    return TokenResponse(access_token=create_access_token(user.id))
