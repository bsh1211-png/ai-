from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.constants import CURRENT_POLICY_VERSION
from app.db import get_db
from app.models.user import BodyImageConsent, BodyImageConsentType, User
from app.schemas.consent import BodyImageConsentRequest, ConsentStatusResponse
from app.services.consent_gate import active_body_image_consent, upload_block_reason
from app.services.user_data_service import delete_all_user_media

router = APIRouter(prefix="/consents", tags=["consents"])


@router.post("/body-image", status_code=status.HTTP_201_CREATED)
def consent_body_image(
    payload: BodyImageConsentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not payload.consented:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="동의가 필요합니다")

    # 촬영/신체사진 사용 + AI 분석 + 히스토리 저장·보관을 하나의 동의로 받되,
    # 감사 추적을 위해 각 항목을 개별 레코드로 남긴다.
    now = datetime.now(timezone.utc)
    for consent_type in (
        BodyImageConsentType.camera_and_body_image,
        BodyImageConsentType.analysis,
        BodyImageConsentType.storage,
    ):
        db.add(
            BodyImageConsent(
                user_id=current_user.id,
                consent_type=consent_type,
                consented_at=now,
                policy_version=CURRENT_POLICY_VERSION,
            )
        )
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

    # 활성 동의 전체를 철회 처리
    now = datetime.now(timezone.utc)
    db.query(BodyImageConsent).filter(
        BodyImageConsent.user_id == current_user.id,
        BodyImageConsent.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)
    db.commit()

    # 약속대로: 철회 즉시 저장한 신체 사진·분석 데이터를 완전 삭제
    deleted_photos = delete_all_user_media(db, current_user.id)
    return {"status": "revoked", "deleted_photos": deleted_photos}


@router.get("/me", response_model=ConsentStatusResponse)
def my_consent_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConsentStatusResponse:
    consent = active_body_image_consent(db, current_user)
    reason = upload_block_reason(db, current_user)
    return ConsentStatusResponse(
        is_minor=current_user.is_minor,
        body_image_consent_active=consent is not None,
        can_upload=reason is None,
        blocked_reason=reason,
    )
