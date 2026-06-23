from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.exercise import Exercise

EXERCISES_PER_WEAK_POINT = 3


def match_exercises_for_weak_points(db: Session, weak_points: list[dict]) -> list[str]:
    """weak_points([{part, severity, comment}, ...])에 맞는 운동 id를 매칭.

    운동 테이블이 수백 건 규모라 메모리에 올려 muscle 태그로 필터링한다.
    (대규모로 커지면 muscle별 인덱스 테이블로 교체)
    """
    all_exercises = db.execute(select(Exercise)).scalars().all()
    matched_ids: list[str] = []
    seen: set[str] = set()

    for weak_point in weak_points:
        part = (weak_point.get("part") or "").lower()
        if not part:
            continue

        count = 0
        for exercise in all_exercises:
            if str(exercise.id) in seen:
                continue
            muscles = [m.lower() for m in (exercise.primary_muscles or []) + (exercise.secondary_muscles or [])]
            if part in muscles:
                matched_ids.append(str(exercise.id))
                seen.add(str(exercise.id))
                count += 1
            if count >= EXERCISES_PER_WEAK_POINT:
                break

    return matched_ids
