import logging
import time

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.scan import BodyGoal, BodyScanSession, PoseMetric, ScanStatus, VisionAnalysis
from app.services import pose_service, vision_service
from app.services.report_composer import compose_report
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
RETRY_BACKOFF_SECONDS = 8


def run_analysis(session_id) -> None:
    """업로드 완료된 세션에 대해 pose + vision 분석을 수행하고 리포트를 생성한다.

    FastAPI BackgroundTasks로 호출되므로 자체 DB 세션을 새로 연다.
    """
    db: Session = SessionLocal()
    try:
        session = db.get(BodyScanSession, session_id)
        if session is None:
            return

        session.status = ScanStatus.processing
        db.commit()

        pose_summaries = []
        for image in session.images:
            if image.deleted_at is not None:
                continue
            image_bytes = storage_service.read_bytes(image.storage_path)
            pose_result = pose_service.analyze_pose(image_bytes)
            if pose_result is None:
                continue
            db.add(
                PoseMetric(
                    scan_image_id=image.id,
                    landmarks_json=pose_result["landmarks_json"],
                    shoulder_width_ratio=pose_result["shoulder_width_ratio"],
                    waist_hip_ratio=pose_result["waist_hip_ratio"],
                    limb_symmetry_score=pose_result["limb_symmetry_score"],
                    posture_flags=pose_result["posture_flags"],
                    raw_confidence=pose_result["raw_confidence"],
                )
            )
            pose_summaries.append(
                {
                    "angle": image.angle.value,
                    "shoulder_width_ratio": pose_result["shoulder_width_ratio"],
                    "limb_symmetry_score": pose_result["limb_symmetry_score"],
                }
            )
        db.commit()

        primary_image = next((img for img in session.images if img.deleted_at is None), None)
        if primary_image is None:
            session.status = ScanStatus.failed
            session.error_message = "분석할 이미지가 없습니다"
            db.commit()
            return

        goal = (
            db.query(BodyGoal)
            .filter(BodyGoal.user_id == session.user_id, BodyGoal.is_active.is_(True))
            .order_by(BodyGoal.created_at.desc())
            .first()
        )
        goal_text = goal.goal_text if goal else None
        image_bytes = storage_service.read_bytes(primary_image.storage_path)

        vision_result = None
        for attempt in range(MAX_RETRIES):
            try:
                vision_result = vision_service.analyze_body_image(
                    db, image_bytes, {"images": pose_summaries}, goal_text
                )
                break
            except vision_service.DailyQuotaExceeded:
                session.status = ScanStatus.failed
                session.error_message = "오늘의 AI 분석 요청 한도를 초과했습니다. 내일 다시 시도해주세요."
                db.commit()
                return
            except vision_service.StillAnalyzing:
                logger.info("Gemini rate limited, retry %s/%s", attempt + 1, MAX_RETRIES)
                time.sleep(RETRY_BACKOFF_SECONDS)

        if vision_result is None:
            # 재시도를 다 소진했지만 한도 초과는 아님 -> 실패가 아니라 "분석 중"으로 유지해
            # 클라이언트가 계속 폴링하면 이후 별도 재시도 트리거로 이어질 수 있게 한다.
            session.status = ScanStatus.processing
            db.commit()
            return

        db.add(
            VisionAnalysis(
                session_id=session.id,
                model_version="gemini",
                body_part_assessment=vision_result.get("body_part_assessment", {}),
                overall_comment=vision_result.get("overall_comment", ""),
                disclaimer_shown=True,
                raw_response=vision_result,
            )
        )
        db.commit()

        compose_report(
            db,
            session_id=session.id,
            user_id=session.user_id,
            vision_result=vision_result,
            pose_summary={"images": pose_summaries},
        )

        session.status = ScanStatus.completed
        db.commit()
    except Exception:
        logger.exception("analysis pipeline failed for session %s", session_id)
        session = db.get(BodyScanSession, session_id)
        if session is not None:
            session.status = ScanStatus.failed
            session.error_message = "분석 중 알 수 없는 오류가 발생했습니다"
            db.commit()
    finally:
        db.close()
