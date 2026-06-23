from sqlalchemy.orm import Session

from app.models.scan import AnalysisReport, BodyGoal
from app.services.exercise_matcher import match_exercises_for_weak_points


def compose_report(
    db: Session,
    session_id,
    user_id,
    vision_result: dict,
    pose_summary: dict,
) -> AnalysisReport:
    weak_points = vision_result.get("weak_points", [])
    recommended_exercise_ids = match_exercises_for_weak_points(db, weak_points)

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
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
