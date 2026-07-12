from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models.progress import ProgressLog
from app.models.scan import BodyGoal
from app.models.user import BodyImageConsent, User
from app.schemas.auth import UserResponse
from app.services.user_data_service import delete_all_user_media

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """회원 탈퇴: 신체 사진·분석 데이터를 즉시 완전 삭제하고 개인정보를 익명화한다."""
    now = datetime.now(timezone.utc)

    # 1) 사진·분석 데이터 완전 삭제 (스토리지 파일 포함)
    deleted_photos = delete_all_user_media(db, current_user.id)

    # 2) 목표·진행기록 등 나머지 개인 데이터 삭제
    db.query(BodyGoal).filter(BodyGoal.user_id == current_user.id).delete(synchronize_session=False)
    db.query(ProgressLog).filter(ProgressLog.user_id == current_user.id).delete(synchronize_session=False)

    # 3) 동의 전체 철회 처리
    db.query(BodyImageConsent).filter(
        BodyImageConsent.user_id == current_user.id,
        BodyImageConsent.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)

    # 4) 계정 익명화 + 탈퇴 처리 (재식별 불가하도록 PII 제거)
    user = db.get(User, current_user.id)
    user.deleted_at = now
    user.email = f"deleted+{user.id}@deleted.local"
    user.oauth_id = None
    user.password_hash = None
    user.guardian_email = None
    db.commit()

    return {"status": "deleted", "deleted_photos": deleted_photos}
