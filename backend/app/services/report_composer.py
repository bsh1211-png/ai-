import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.exercise import Exercise
from app.models.scan import AnalysisReport, BodyGoal
from app.services.exercise_matcher import match_exercises_grouped

SEVERITY_SETS = {"high": 4, "medium": 3, "low": 3}
DEFAULT_REPS = 12
DEFAULT_REST_SECONDS = 60

# 체지방 추정치가 이 값(%) 이상이면 근력 운동과 별개로 유산소를 추가 추천한다.
CARDIO_BODY_FAT_THRESHOLD = 20
CARDIO_DURATION_MINUTES = 20
CARDIO_NAME_PREFERENCE = ["run", "jog"]


def _build_routine(grouped: list[tuple[dict, list]]) -> dict:
    items = []
    for weak_point, exercises in grouped:
        sets = SEVERITY_SETS.get(weak_point.get("severity", "medium"), 3)
        for exercise in exercises:
            items.append(
                {
                    "exercise_id": str(exercise.id),
                    "exercise_name": exercise.name_ko or exercise.name_en,
                    "target_part": weak_point.get("part"),
                    "sets": sets,
                    "reps": DEFAULT_REPS,
                    "rest_seconds": DEFAULT_REST_SECONDS,
                }
            )
    return {"name": "보완 부위 집중 루틴", "items": items}


def _pick_cardio_exercise(db: Session) -> Exercise | None:
    cardio_exercises = db.execute(select(Exercise).where(Exercise.category == "cardio")).scalars().all()
    if not cardio_exercises:
        return None
    preferred = [
        e for e in cardio_exercises if any(p in e.name_en.lower() for p in CARDIO_NAME_PREFERENCE)
    ]
    return random.choice(preferred or cardio_exercises)


def _average_symmetry_score(pose_summary: dict) -> int | None:
    """MediaPipe로 실제 측정된 좌우 대칭성(0~1)의 평균을 0~100 점수로 환산.

    헤드라인 스탯의 나머지 값들과 달리 AI 추정이 아니라 실측 기반 값이다.
    """
    scores = [
        img["limb_symmetry_score"]
        for img in pose_summary.get("images", [])
        if img.get("limb_symmetry_score") is not None
    ]
    if not scores:
        return None
    return round(sum(scores) / len(scores) * 100)


def compose_report(
    db: Session,
    session_id,
    user_id,
    vision_result: dict,
    pose_summary: dict,
) -> AnalysisReport:
    weak_points = vision_result.get("weak_points", [])
    # '줄이기(reduce)' 방향 부위는 근비대 운동을 추천하면 안 되므로 운동 매칭에서 제외한다
    # (리포트 표시에는 그대로 남아 조언을 보여준다).
    growable_points = [wp for wp in weak_points if wp.get("goal_action") != "reduce"]
    grouped = match_exercises_grouped(db, growable_points)
    recommended_exercise_ids = [str(ex.id) for _, exercises in grouped for ex in exercises]
    recommended_routine = _build_routine(grouped)

    headline_stats = dict(vision_result.get("headline_stats") or {})
    headline_stats["symmetry_score"] = _average_symmetry_score(pose_summary)

    goal_alignment = vision_result.get("goal_alignment") or {}
    # 모델이 sync_rate를 goal_alignment에만 넣었을 수 있으니 headline_stats에도 반영한다.
    if headline_stats.get("sync_rate") is None and goal_alignment.get("sync_rate") is not None:
        headline_stats["sync_rate"] = goal_alignment.get("sync_rate")

    direction = goal_alignment.get("direction")
    has_reduce_point = any(wp.get("goal_action") == "reduce" for wp in weak_points)
    body_fat = headline_stats.get("body_fat_estimate_pct")
    needs_cardio = (
        (body_fat is not None and body_fat >= CARDIO_BODY_FAT_THRESHOLD)
        or direction == "slim_down"
        or has_reduce_point
    )
    if needs_cardio:
        cardio = _pick_cardio_exercise(db)
        if cardio is not None and str(cardio.id) not in recommended_exercise_ids:
            recommended_exercise_ids.append(str(cardio.id))
            recommended_routine["items"].append(
                {
                    "exercise_id": str(cardio.id),
                    "exercise_name": cardio.name_ko or cardio.name_en,
                    "target_part": "체지방 감량 · 유산소",
                    "sets": None,
                    "reps": None,
                    "duration_minutes": CARDIO_DURATION_MINUTES,
                    "rest_seconds": 0,
                }
            )

    goal = (
        db.query(BodyGoal)
        .filter(BodyGoal.user_id == user_id, BodyGoal.is_active.is_(True))
        .order_by(BodyGoal.created_at.desc())
        .first()
    )
    goal_comparison = None
    if goal is not None:
        goal_comparison = {
            "goal_type": goal.goal_type.value,
            "goal_text": goal.goal_text,
            "sync_rate": headline_stats.get("sync_rate"),
            "direction": direction,
            "feedback": goal_alignment.get("feedback"),
        }

    report = AnalysisReport(
        session_id=session_id,
        summary=vision_result.get("overall_comment", ""),
        weak_points=weak_points,
        recommended_exercise_ids=recommended_exercise_ids,
        goal_comparison=goal_comparison,
        headline_stats=headline_stats,
        recommended_routine=recommended_routine,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
