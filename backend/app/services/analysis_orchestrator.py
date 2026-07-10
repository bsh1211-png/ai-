import logging
import time

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.scan import BodyGoal, BodyScanSession, PoseMetric, ScanStatus, VisionAnalysis
from app.models.user import User
from app.services import moderation, pose_service, vision_service
from app.services.report_composer import compose_report
from app.services.storage_service import storage_service


def _handle_explicit_content(db: Session, session: BodyScanSession) -> None:
    """노골적 성적 이미지 감지 시: 스트라이크 누적, 한도 도달 시 영구 정지."""
    user = db.get(User, session.user_id)
    if user is not None:
        strikes, banned = moderation.register_nsfw_strike(db, user)
    else:
        strikes, banned = moderation.NSFW_STRIKE_LIMIT, True

    session.status = ScanStatus.failed
    session.error_message = moderation.nsfw_warning_message(strikes, banned)
    db.commit()

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

        if not pose_summaries:
            # 모든 사진에서 신체를 인식하지 못함 -> 부정확한 분석을 만들지 말고 재촬영을 요청한다.
            session.status = ScanStatus.failed
            session.error_message = (
                "사진에서 신체를 정확히 인식하지 못했어요. 밝은 곳에서 전신/해당 부위가 잘 보이도록 "
                "다시 촬영해주세요."
            )
            db.commit()
            return

        goal = (
            db.query(BodyGoal)
            .filter(BodyGoal.user_id == session.user_id, BodyGoal.is_active.is_(True))
            .order_by(BodyGoal.created_at.desc())
            .first()
        )
        goal_text = goal.goal_text if goal else None
        goal_image_bytes = None
        if goal and goal.reference_image_path:
            goal_image_bytes = storage_service.read_bytes(goal.reference_image_path)
        image_bytes = storage_service.read_bytes(primary_image.storage_path)

        # 미성년자는 채점은 동일하게 깐깐하되 코멘트 톤을 건설적으로 (인신공격성 독설 방지)
        analysis_user = db.get(User, session.user_id)
        is_minor = bool(analysis_user and analysis_user.is_minor)

        vision_result = None
        for attempt in range(MAX_RETRIES):
            try:
                vision_result = vision_service.analyze_body_image(
                    db,
                    image_bytes,
                    {"images": pose_summaries},
                    goal_text,
                    goal_image_bytes,
                    category=session.category.value,
                    is_minor=is_minor,
                )
                break
            except vision_service.DailyQuotaExceeded:
                session.status = ScanStatus.failed
                session.error_message = "오늘의 AI 분석 요청 한도를 초과했습니다. 내일 다시 시도해주세요."
                db.commit()
                return
            except vision_service.ExplicitContentDetected:
                _handle_explicit_content(db, session)
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
