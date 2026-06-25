from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.exercise import Exercise

EXERCISES_PER_WEAK_POINT = 3


def match_exercises_grouped(db: Session, weak_points: list[dict]) -> list[tuple[dict, list[Exercise]]]:
    """weak_points([{part, severity, comment}, ...]) 각각에 맞는 운동을 매칭.

    운동 테이블이 수백 건 규모라 메모리에 올려 muscle 태그로 필터링한다.
    (대규모로 커지면 muscle별 인덱스 테이블로 교체)
    """
    all_exercises = db.execute(select(Exercise)).scalars().all()
    seen: set[str] = set()
    grouped: list[tuple[dict, list[Exercise]]] = []

    for weak_point in weak_points:
        part = (weak_point.get("part") or "").lower()
        if not part:
            continue

        matched: list[Exercise] = []
        for exercise in all_exercises:
            if str(exercise.id) in seen:
                continue
            muscles = [m.lower() for m in (exercise.primary_muscles or []) + (exercise.secondary_muscles or [])]
            if part in muscles:
                matched.append(exercise)
                seen.add(str(exercise.id))
            if len(matched) >= EXERCISES_PER_WEAK_POINT:
                break
        grouped.append((weak_point, matched))

    return grouped
