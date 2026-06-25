"""Free Exercise DB에 없는 부위(전거근 등)를 위한 수동 큐레이션 운동 시딩.

이미지/영상 없이 텍스트 정보만 등록한다 (source=curated로 구분).
재실행해도 external_id 기준으로 중복 삽입하지 않는다.

사용법: backend/ 에서 `python -m scripts.seed_curated_exercises`
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal  # noqa: E402
from app.models.exercise import Exercise, ExerciseSource  # noqa: E402

CURATED_EXERCISES = [
    {
        "external_id": "curated-scapular-pushup",
        "name_en": "Scapular Push-up",
        "name_ko": "스캐퓰러 푸시업",
        "category": "strength",
        "primary_muscles": ["serratus anterior"],
        "secondary_muscles": ["chest", "shoulders"],
        "equipment": "body only",
        "level": "beginner",
    },
    {
        "external_id": "curated-landmine-press",
        "name_en": "Landmine Press",
        "name_ko": "랜드마인 프레스",
        "category": "strength",
        "primary_muscles": ["serratus anterior"],
        "secondary_muscles": ["shoulders", "chest"],
        "equipment": "barbell",
        "level": "intermediate",
    },
    {
        "external_id": "curated-plank-reach",
        "name_en": "Plank Reach-Through",
        "name_ko": "플랭크 리치스로",
        "category": "strength",
        "primary_muscles": ["serratus anterior"],
        "secondary_muscles": ["abdominals"],
        "equipment": "body only",
        "level": "beginner",
    },
]


def seed() -> int:
    db = SessionLocal()
    inserted = 0
    try:
        existing_ids = {row[0] for row in db.query(Exercise.external_id).all()}
        for data in CURATED_EXERCISES:
            if data["external_id"] in existing_ids:
                continue
            db.add(Exercise(**data, image_paths=[], source=ExerciseSource.curated))
            inserted += 1
        db.commit()
    finally:
        db.close()
    return inserted


if __name__ == "__main__":
    count = seed()
    print(f"완료: {count}건 신규 시딩")
