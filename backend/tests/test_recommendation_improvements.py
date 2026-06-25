import uuid

from app.models.exercise import Exercise, ExerciseSource
from app.services import vision_service
from app.services.exercise_matcher import match_exercises_grouped
from app.services.report_composer import compose_report


def test_lower_category_excludes_upper_body_muscles():
    lower_tags = vision_service._allowed_muscle_tags("lower")
    assert "abdominals" not in lower_tags
    assert "chest" not in lower_tags
    assert "quadriceps" in lower_tags
    assert "glutes" in lower_tags


def test_upper_category_includes_abdominals_and_serratus():
    upper_tags = vision_service._allowed_muscle_tags("upper")
    assert "abdominals" in upper_tags
    assert "serratus anterior" in upper_tags
    assert "quadriceps" not in upper_tags


def test_system_instruction_only_lists_allowed_tags_for_category():
    instruction = vision_service._build_system_instruction("lower")
    assert "abdominals" not in instruction
    assert "quadriceps" in instruction


def _make_exercises(db, part: str, count: int) -> list[str]:
    ids = []
    for i in range(count):
        ex = Exercise(
            external_id=f"test-{part}-{i}-{uuid.uuid4()}",
            name_en=f"{part} exercise {i}",
            primary_muscles=[part],
            secondary_muscles=[],
            source=ExerciseSource.curated,
        )
        db.add(ex)
        db.flush()
        ids.append(str(ex.id))
    db.commit()
    return ids


def test_exercise_matching_varies_across_calls(client):
    db = client.TestingSessionLocal()
    _make_exercises(db, "chest", 10)
    db.close()

    db = client.TestingSessionLocal()
    weak_points = [{"part": "chest", "severity": "medium", "comment": "테스트"}]
    results = set()
    for _ in range(15):
        grouped = match_exercises_grouped(db, weak_points)
        results.add(tuple(sorted(str(e.id) for e in grouped[0][1])))
    db.close()

    # 10개 후보 중 3개씩 뽑으니 매번 같은 조합만 나오면 안 됨
    assert len(results) > 1


def test_cardio_recommended_when_body_fat_high(client):
    db = client.TestingSessionLocal()
    cardio = Exercise(
        external_id="test-cardio-running",
        name_en="Running, Treadmill",
        category="cardio",
        primary_muscles=[],
        secondary_muscles=[],
        source=ExerciseSource.free_exercise_db,
    )
    db.add(cardio)
    db.commit()
    cardio_id = str(cardio.id)

    report = compose_report(
        db,
        session_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        vision_result={
            "overall_comment": "테스트",
            "weak_points": [],
            "headline_stats": {"body_fat_estimate_pct": 25, "percentile": 50},
        },
        pose_summary={"images": []},
    )

    assert cardio_id in report.recommended_exercise_ids
    cardio_items = [i for i in report.recommended_routine["items"] if i["exercise_id"] == cardio_id]
    assert len(cardio_items) == 1
    assert cardio_items[0]["duration_minutes"] == 20
    db.close()


def test_cardio_not_recommended_when_body_fat_low(client):
    db = client.TestingSessionLocal()
    cardio = Exercise(
        external_id="test-cardio-running-2",
        name_en="Running, Treadmill",
        category="cardio",
        primary_muscles=[],
        secondary_muscles=[],
        source=ExerciseSource.free_exercise_db,
    )
    db.add(cardio)
    db.commit()

    report = compose_report(
        db,
        session_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        vision_result={
            "overall_comment": "테스트",
            "weak_points": [],
            "headline_stats": {"body_fat_estimate_pct": 12, "percentile": 20},
        },
        pose_summary={"images": []},
    )

    assert report.recommended_exercise_ids == []
    db.close()
