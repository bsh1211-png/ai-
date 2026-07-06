"""yuhonas/free-exercise-db(CC0)의 운동 메타데이터를 exercises 테이블에 시딩.

대표 이미지 1장의 jsDelivr CDN URL을 그대로 저장한다(로컬/Supabase 저장 불필요,
CDN에서 항상 로드되므로 배포 환경의 임시 디스크 문제에 영향받지 않는다).
재실행해도 external_id 기준으로 중복 삽입하지 않는다.

사용법: backend/ 에서 `python -m scripts.seed_free_exercise_db`
"""

import sys
from pathlib import Path

import requests

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal  # noqa: E402
from app.models.exercise import Exercise, ExerciseSource  # noqa: E402
from app.services.youtube_service import search_exercise_videos  # noqa: E402

EXERCISES_JSON_URL = (
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
)
# jsDelivr CDN — GitHub raw보다 이미지 서빙에 안정적
IMAGE_BASE_URL = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/"


def fetch_exercises() -> list[dict]:
    response = requests.get(EXERCISES_JSON_URL, timeout=30)
    response.raise_for_status()
    return response.json()


def first_image_url(exercise: dict) -> list[str]:
    images = exercise.get("images") or []
    if not images:
        return []
    return [IMAGE_BASE_URL + images[0]]


def seed(limit: int | None = None) -> int:
    exercises = fetch_exercises()
    if limit:
        exercises = exercises[:limit]

    db = SessionLocal()
    inserted = 0
    try:
        existing_ids = {row[0] for row in db.query(Exercise.external_id).all()}
        for raw in exercises:
            external_id = raw.get("id")
            if not external_id or external_id in existing_ids:
                continue

            image_paths = first_image_url(raw)
            exercise = Exercise(
                external_id=external_id,
                name_en=raw.get("name", ""),
                category=raw.get("category"),
                primary_muscles=raw.get("primaryMuscles", []),
                secondary_muscles=raw.get("secondaryMuscles", []),
                equipment=raw.get("equipment"),
                level=raw.get("level"),
                image_paths=image_paths,
                youtube_video_ids=search_exercise_videos(raw.get("name", "")),
                source=ExerciseSource.free_exercise_db,
            )
            db.add(exercise)
            inserted += 1
            if inserted % 50 == 0:
                db.commit()
                print(f"  ...{inserted}건 시딩됨")
        db.commit()
    finally:
        db.close()

    return inserted


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="테스트용 시딩 개수 제한")
    args = parser.parse_args()

    count = seed(limit=args.limit)
    print(f"완료: {count}건 신규 시딩")
