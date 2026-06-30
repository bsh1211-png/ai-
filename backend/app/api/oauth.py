import logging
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import (
    create_access_token,
    create_guardian_consent_token,
    create_oauth_pending_token,
    create_oauth_state_token,
    decode_oauth_pending_token,
    decode_oauth_state_token,
)
from app.db import SessionLocal
from app.models.user import OAuthProvider, User
from app.schemas.auth import OAuthCompleteSignupRequest, SignupResponse
from app.services import oauth_providers
from app.services.oauth_providers import OAuthEmailMissing, OAuthNotConfigured
from app.services.user_signup import create_user_and_consents

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oauth", tags=["oauth"])


@router.get("/{provider}/start")
def oauth_start(provider: OAuthProvider):
    if provider != OAuthProvider.google:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google 로그인만 지원합니다")
    try:
        state = create_oauth_state_token(provider.value)
        url = oauth_providers.build_authorize_url(provider, state)
    except OAuthNotConfigured as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return RedirectResponse(url)


@router.get("/{provider}/callback")
def oauth_callback(provider: OAuthProvider, code: str = Query(...), state: str = Query(...)):
    frontend_complete_url = f"{settings.frontend_base_url}/oauth/complete"

    if provider != OAuthProvider.google:
        return RedirectResponse(f"{frontend_complete_url}?{urlencode({'error': 'Google 로그인만 지원합니다'})}")

    if not decode_oauth_state_token(state, provider.value):
        return RedirectResponse(f"{frontend_complete_url}?{urlencode({'error': '유효하지 않은 요청입니다'})}")

    try:
        user_info = oauth_providers.complete_oauth_login(provider, code)
    except OAuthEmailMissing as error:
        return RedirectResponse(f"{frontend_complete_url}?{urlencode({'error': str(error)})}")
    except Exception:
        logger.exception("OAuth 콜백 처리 실패 (provider=%s)", provider.value)
        return RedirectResponse(
            f"{frontend_complete_url}?{urlencode({'error': '소셜 로그인 처리 중 오류가 발생했습니다'})}"
        )

    db: Session = SessionLocal()
    try:
        existing = (
            db.query(User)
            .filter(User.oauth_provider == provider, User.oauth_id == user_info.external_id)
            .first()
        )
        if existing:
            token = create_access_token(existing.id)
            return RedirectResponse(f"{frontend_complete_url}?{urlencode({'token': token})}")

        # 신규 가입: 생년월일/동의가 더 필요하므로 임시 토큰만 발급
        pending_token = create_oauth_pending_token(provider.value, user_info.external_id, user_info.email)
        return RedirectResponse(
            f"{frontend_complete_url}?{urlencode({'pending': pending_token, 'email': user_info.email})}"
        )
    finally:
        db.close()


@router.post("/complete-signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def oauth_complete_signup(payload: OAuthCompleteSignupRequest):
    claims = decode_oauth_pending_token(payload.pending_token)
    if claims is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="만료되었거나 유효하지 않은 요청입니다")

    db: Session = SessionLocal()
    try:
        user = create_user_and_consents(
            db,
            email=claims["email"],
            birth_date=payload.birth_date,
            accept_terms=payload.accept_terms,
            accept_privacy=payload.accept_privacy,
            accept_marketing=payload.accept_marketing,
            guardian_email=payload.guardian_email,
            oauth_provider=OAuthProvider(claims["provider"]),
            oauth_id=claims["external_id"],
        )

        guardian_token = None
        if user.is_minor and settings.environment == "development":
            guardian_token = create_guardian_consent_token(user.id)

        return SignupResponse(
            access_token=create_access_token(user.id),
            is_minor=user.is_minor,
            guardian_consent_dev_token=guardian_token,
        )
    finally:
        db.close()
