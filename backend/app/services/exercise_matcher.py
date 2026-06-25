import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.exercise import Exercise

EXERCISES_PER_WEAK_POINT = 3


def _candidates_for_part(part: str, exercises: list[Exercise], seen: set[str]) -> list[Exercise]:
    primary, secondary = [], []
    for exercise in exercises:
        if str(exercise.id) in seen:
            continue
        primary_muscles = [m.lower() for m in (exercise.primary_muscles or [])]
        secondary_muscles = [m.lower() for m in (exercise.secondary_muscles or [])]
        if part in primary_muscles:
            primary.append(exercise)
        elif part in secondary_muscles:
            secondary.append(exercise)
    # 주동근으로 매칭된 운동을 우선하고, 부족하면 보조근 매칭으로 채운다.
    return primary + secondary


def match_exercises_grouped(db: Session, weak_points: list[dict]) -> list[tuple[dict, list[Exercise]]]:
    """weak_points([{part, severity, comment}, ...]) 각각에 맞는 운동을 매칭.

    매번 같은 운동만 추천되지 않도록 매칭된 후보 중에서 무작위로 선택한다.
    운동 테이블이 수백 건 규모라 메모리에 올려 muscle 태그로 필터링한다.
    """
    all_exercises = db.execute(select(Exercise)).scalars().all()
    seen: set[str] = set()
    grouped: list[tuple[dict, list[Exercise]]] = []

    for weak_point in weak_points:
        part = (weak_point.get("part") or "").lower()
        if not part:
            continue

        candidates = _candidates_for_part(part, all_exercises, seen)
        # 주동근 매칭이 충분하면 그 안에서만 무작위 추출해 관련성을 유지한다.
        primary_count = sum(1 for c in candidates if part in [m.lower() for m in (c.primary_muscles or [])])
        pool = candidates[:primary_count] if primary_count >= EXERCISES_PER_WEAK_POINT else candidates

        matched = random.sample(pool, k=min(EXERCISES_PER_WEAK_POINT, len(pool)))
        seen.update(str(e.id) for e in matched)
        grouped.append((weak_point, matched))

    return grouped
