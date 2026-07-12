"""사용자 신체 사진·분석 데이터의 완전 삭제 유틸.

동의 철회 / 회원 탈퇴 시 "저장한 사진을 즉시 삭제한다"는 약속을 실제로 이행하기 위한
공통 로직. 스캔 세션 이미지와 목표(워너비) 참조 이미지를 스토리지에서 지우고,
관련 DB 레코드(세션/이미지/자세지표/비전분석/리포트)를 정리한다.
"""

import logging
import uuid

from sqlalchemy.orm import Session

from app.models.scan import (
    AnalysisReport,
    BodyGoal,
    BodyScanImage,
    BodyScanSession,
    PoseMetric,
    VisionAnalysis,
)
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)


def _safe_delete(path: str | None) -> bool:
    if not path:
        return False
    try:
        storage_service.delete(path)
        return True
    except Exception:
        # 이미 없거나 스토리지 오류여도 DB 정리는 계속 진행 (약속 이행이 우선)
        logger.warning("스토리지 파일 삭제 실패(무시하고 진행): %s", path)
        return False


def delete_all_user_media(db: Session, user_id: uuid.UUID) -> int:
    """사용자의 모든 신체 사진과 분석 데이터를 스토리지·DB에서 완전 삭제한다.

    삭제한 이미지 파일 개수를 반환한다. 호출 측에서 별도 commit 불필요(여기서 commit).
    """
    deleted_files = 0

    # 1) 스캔 세션 및 하위 데이터
    session_ids = [
        row.id for row in db.query(BodyScanSession.id).filter(BodyScanSession.user_id == user_id).all()
    ]
    if session_ids:
        image_rows = (
            db.query(BodyScanImage.id, BodyScanImage.storage_path)
            .filter(BodyScanImage.session_id.in_(session_ids))
            .all()
        )
        image_ids = [row.id for row in image_rows]
        if image_ids:
            db.query(PoseMetric).filter(PoseMetric.scan_image_id.in_(image_ids)).delete(
                synchronize_session=False
            )
        db.query(VisionAnalysis).filter(VisionAnalysis.session_id.in_(session_ids)).delete(
            synchronize_session=False
        )
        db.query(AnalysisReport).filter(AnalysisReport.session_id.in_(session_ids)).delete(
            synchronize_session=False
        )
        for _, storage_path in image_rows:
            if _safe_delete(storage_path):
                deleted_files += 1
        db.query(BodyScanImage).filter(BodyScanImage.session_id.in_(session_ids)).delete(
            synchronize_session=False
        )
        db.query(BodyScanSession).filter(BodyScanSession.id.in_(session_ids)).delete(
            synchronize_session=False
        )

    # 2) 목표(워너비) 참조 이미지 — 사진이므로 함께 삭제 (goal_text 등 텍스트는 유지)
    goals = db.query(BodyGoal).filter(BodyGoal.user_id == user_id).all()
    for goal in goals:
        if goal.reference_image_path:
            if _safe_delete(goal.reference_image_path):
                deleted_files += 1
            goal.reference_image_path = None

    db.commit()
    logger.info("사용자 %s의 신체 사진 %d개 및 분석 데이터 삭제 완료", user_id, deleted_files)
    return deleted_files
