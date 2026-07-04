import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, get_current_user
from app.db import get_db
from app.models.scan import (
    AnalysisReport,
    BodyScanImage,
    BodyScanSession,
    ImageAngle,
    PoseMetric,
    ScanCategory,
    ScanStatus,
    VisionAnalysis,
)
from app.models.user import User
from app.schemas.scan import AnalysisReportResponse, ScanSessionCreateRequest, ScanSessionResponse
from app.services.analysis_orchestrator import run_analysis
from app.services.consent_gate import upload_block_reason
from app.services.storage_service import storage_service

router = APIRouter(prefix="/scans", tags=["scans"])


def _get_owned_session(db: Session, session_id: uuid.UUID, user: User) -> BodyScanSession:
    session = db.get(BodyScanSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="세션을 찾을 수 없습니다")
    return session


@router.post("", response_model=ScanSessionResponse, status_code=status.HTTP_201_CREATED)
def create_scan_session(
    payload: ScanSessionCreateRequest,
    current_user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
) -> BodyScanSession:
    try:
        category = ScanCategory(payload.category)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="잘못된 카테고리입니다") from error

    session = BodyScanSession(
        user_id=current_user.id,
        scan_date=datetime.now(timezone.utc),
        category=category,
        status=ScanStatus.uploaded,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[ScanSessionResponse])
def list_scan_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BodyScanSession]:
    return (
        db.query(BodyScanSession)
        .filter(BodyScanSession.user_id == current_user.id)
        .order_by(BodyScanSession.scan_date.desc())
        .all()
    )


@router.get("/{session_id}", response_model=ScanSessionResponse)
def get_scan_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BodyScanSession:
    return _get_owned_session(db, session_id, current_user)


@router.post("/{session_id}/images", response_model=ScanSessionResponse)
async def upload_scan_image(
    session_id: uuid.UUID,
    angle: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
) -> BodyScanSession:
    session = _get_owned_session(db, session_id, current_user)

    block_reason = upload_block_reason(db, current_user)
    if block_reason:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=block_reason)

    try:
        angle_enum = ImageAngle(angle)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="잘못된 angle 값입니다") from error

    content = await file.read()
    suffix = "." + (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg")
    storage_path = storage_service.save_bytes(f"scans/{current_user.id}", content, suffix=suffix)

    image = BodyScanImage(
        session_id=session.id,
        angle=angle_enum,
        storage_path=storage_path,
        uploaded_at=datetime.now(timezone.utc),
    )
    db.add(image)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}/images/{image_id}/file")
def get_scan_image_file(
    session_id: uuid.UUID,
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    session = _get_owned_session(db, session_id, current_user)
    image = db.get(BodyScanImage, image_id)
    if image is None or image.session_id != session.id or image.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="이미지를 찾을 수 없습니다")

    content = storage_service.read_bytes(image.storage_path)
    return Response(content=content, media_type="image/jpeg")


@router.post("/{session_id}/analyze", status_code=status.HTTP_202_ACCEPTED)
def trigger_analysis(
    session_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(db, session_id, current_user)
    active_images = [img for img in session.images if img.deleted_at is None]
    if not active_images:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="업로드된 이미지가 없습니다")

    background_tasks.add_task(run_analysis, session.id)
    return {"status": "scheduled"}


@router.get("/{session_id}/report", response_model=AnalysisReportResponse)
def get_scan_report(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisReport:
    session = _get_owned_session(db, session_id, current_user)
    report = db.query(AnalysisReport).filter(AnalysisReport.session_id == session.id).first()
    if report is None:
        detail = session.error_message or f"리포트가 아직 준비되지 않았습니다 (status={session.status.value})"
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return report


@router.delete("/{session_id}", status_code=status.HTTP_200_OK)
def delete_scan_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(db, session_id, current_user)

    # ORM identity map에 BodyScanImage가 올라간 채로 bulk delete를 하면
    # session.delete() 시 고아 FK를 갱신하려다 StaleDataError가 나므로,
    # 컬럼만 조회해 관계 로딩을 피하고 끝에 raw delete로 정리한다.
    image_rows = (
        db.query(BodyScanImage.id, BodyScanImage.storage_path)
        .filter(BodyScanImage.session_id == session.id)
        .all()
    )
    image_ids = [row.id for row in image_rows]

    if image_ids:
        db.query(PoseMetric).filter(PoseMetric.scan_image_id.in_(image_ids)).delete(synchronize_session=False)
    db.query(VisionAnalysis).filter(VisionAnalysis.session_id == session.id).delete(synchronize_session=False)
    db.query(AnalysisReport).filter(AnalysisReport.session_id == session.id).delete(synchronize_session=False)

    for _, storage_path in image_rows:
        storage_service.delete(storage_path)
    db.query(BodyScanImage).filter(BodyScanImage.session_id == session.id).delete(synchronize_session=False)

    db.query(BodyScanSession).filter(BodyScanSession.id == session.id).delete(synchronize_session=False)
    db.commit()
    return {"status": "deleted"}
