from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.security import create_access_token, create_guardian_consent_token, hash_password, verify_password
from app.db import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, SignupResponse, TokenResponse, UserResponse
from app.services.user_signup import create_user_and_consents

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> SignupResponse:
    user = create_user_and_consents(
        db,
        email=payload.email,
        birth_date=payload.birth_date,
        accept_terms=payload.accept_terms,
        accept_privacy=payload.accept_privacy,
        accept_marketing=payload.accept_marketing,
        guardian_email=payload.guardian_email,
        password_hash=hash_password(payload.password),
    )

    # 실제 메일 발송 인프라가 붙기 전까지, 개발 환경에서만 토큰을 응답에 노출해 동의 플로우를 직접 테스트할 수 있게 함.
    guardian_token = None
    if user.is_minor and settings.environment == "development":
        guardian_token = create_guardian_consent_token(user.id)

    return SignupResponse(
        access_token=create_access_token(user.id),
        is_minor=user.is_minor,
        guardian_consent_dev_token=guardian_token,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이메일 또는 비밀번호가 올바르지 않습니다")
    return TokenResponse(access_token=create_access_token(user.id))
