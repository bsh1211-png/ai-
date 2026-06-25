from sqlalchemy.orm import Session

from app.models.scan import AnalysisReport, BodyGoal
from app.services.exercise_matcher import match_exercises_grouped

SEVERITY_SETS = {"high": 4, "medium": 3, "low": 3}
DEFAULT_REPS = 12
DEFAULT_REST_SECONDS = 60


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


def compose_report(
    db: Session,
    session_id,
    user_id,
    vision_result: dict,
    pose_summary: dict,
) -> AnalysisReport:
    weak_points = vision_result.get("weak_points", [])
    grouped = match_exercises_grouped(db, weak_points)
    recommended_exercise_ids = [str(ex.id) for _, exercises in grouped for ex in exercises]
    recommended_routine = _build_routine(grouped)

    goal = (
        db.query(BodyGoal)
        .filter(BodyGoal.user_id == user_id, BodyGoal.is_active.is_(True))
        .order_by(BodyGoal.created_at.desc())
        .first()
    )
    goal_comparison = None
    if goal is not None:
        goal_comparison = {"goal_type": goal.goal_type.value, "goal_text": goal.goal_text}

    report = AnalysisReport(
        session_id=session_id,
        summary=vision_result.get("overall_comment", ""),
        weak_points=weak_points,
        recommended_exercise_ids=recommended_exercise_ids,
        goal_comparison=goal_comparison,
        headline_stats=vision_result.get("headline_stats"),
        recommended_routine=recommended_routine,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
