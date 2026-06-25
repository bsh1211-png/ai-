import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models.progress import ProgressLog
from app.models.user import User
from app.schemas.progress import ProgressLogCreateRequest, ProgressLogResponse

router = APIRouter(prefix="/progress", tags=["progress"])


@router.post("", response_model=ProgressLogResponse, status_code=201)
def create_progress_log(
    payload: ProgressLogCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProgressLog:
    log = ProgressLog(
        user_id=current_user.id,
        weight_kg=payload.weight_kg,
        body_fat_pct=payload.body_fat_pct,
        notes=payload.notes,
        logged_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("", response_model=list[ProgressLogResponse])
def list_progress_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProgressLog]:
    return (
        db.query(ProgressLog)
        .filter(ProgressLog.user_id == current_user.id)
        .order_by(ProgressLog.logged_at.desc())
        .all()
    )


@router.delete("/{log_id}", status_code=status.HTTP_200_OK)
def delete_progress_log(
    log_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    log = db.get(ProgressLog, log_id)
    if log is None or log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="기록을 찾을 수 없습니다")
    db.delete(log)
    db.commit()
    return {"status": "deleted"}
