from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.constants import CURRENT_POLICY_VERSION
from app.core.security import decode_guardian_consent_token
from app.db import get_db
from app.models.user import BodyImageConsent, BodyImageConsentType, GuardianConsentStatus, User
from app.schemas.consent import (
    BodyImageConsentRequest,
    ConsentStatusResponse,
    GuardianConsentConfirmRequest,
)
from app.services.consent_gate import active_body_image_consent, upload_block_reason

router = APIRouter(prefix="/consents", tags=["consents"])


@router.post("/body-image", status_code=status.HTTP_201_CREATED)
def consent_body_image(
    payload: BodyImageConsentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not payload.consented:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="동의가 필요합니다")

    consent = BodyImageConsent(
        user_id=current_user.id,
        consent_type=BodyImageConsentType.camera_and_body_image,
        consented_at=datetime.now(timezone.utc),
        policy_version=CURRENT_POLICY_VERSION,
    )
    db.add(consent)
    db.commit()
    return {"status": "consented"}


@router.delete("/body-image", status_code=status.HTTP_200_OK)
def revoke_body_image_consent(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    consent = active_body_image_consent(db, current_user)
    if consent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="활성화된 동의가 없습니다")
    consent.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "revoked"}


@router.get("/me", response_model=ConsentStatusResponse)
def my_consent_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConsentStatusResponse:
    consent = active_body_image_consent(db, current_user)
    reason = upload_block_reason(db, current_user)
    return ConsentStatusResponse(
        is_minor=current_user.is_minor,
        guardian_consent_status=current_user.guardian_consent_status.value,
        body_image_consent_active=consent is not None,
        can_upload=reason is None,
        blocked_reason=reason,
    )


@router.post("/guardian/confirm")
def confirm_guardian_consent(
    payload: GuardianConsentConfirmRequest,
    db: Session = Depends(get_db),
) -> dict:
    user_id = decode_guardian_consent_token(payload.token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않거나 만료된 토큰입니다")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    user.guardian_consent_status = GuardianConsentStatus.approved
    user.guardian_consent_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "approved"}
