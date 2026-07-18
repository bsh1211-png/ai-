from pathlib import Path

from app.models.exercise import Exercise, ExerciseSource
from app.services import vision_service

FIXTURE_IMAGE = Path(__file__).parent / "fixtures" / "sample_body.jpg"
NO_PERSON_IMAGE = Path(__file__).parent / "fixtures" / "no_person.jpg"


def _signup_and_consent(client, signup, email="scanuser@example.com") -> str:
    resp = signup(email, "1995-01-01")
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/consents/body-image", json={"consented": True}, headers=headers)
    return token


def _get_test_session(client):
    return client.TestingSessionLocal()


def test_full_scan_pipeline_success(client, monkeypatch, signup):
    token = _signup_and_consent(client, signup)
    headers = {"Authorization": f"Bearer {token}"}

    db = _get_test_session(client)
    exercise = Exercise(
        external_id="test-lat-row",
        name_en="Lat Pulldown",
        primary_muscles=["lats"],
        secondary_muscles=[],
        source=ExerciseSource.curated,
    )
    db.add(exercise)
    db.commit()
    exercise_id = str(exercise.id)
    db.close()

    def fake_analyze(db, image_bytes, pose_summary, goal_text, goal_image_bytes=None, category=None, is_minor=False, lang="ko"):
        return {
            "body_part_assessment": {"lats": "성장 여지가 있습니다"},
            "weak_points": [{"part": "lats", "severity": "medium", "comment": "등 근육 발달에 집중해보세요"}],
            "overall_comment": "테스트 코멘트",
        }

    monkeypatch.setattr(vision_service, "analyze_body_image", fake_analyze)

    create_resp = client.post("/scans", json={"category": "upper"}, headers=headers)
    assert create_resp.status_code == 201
    session_id = create_resp.json()["id"]

    with open(FIXTURE_IMAGE, "rb") as f:
        upload_resp = client.post(
            f"/scans/{session_id}/images?angle=back",
            headers=headers,
            files={"file": ("sample.jpg", f, "image/jpeg")},
        )
    assert upload_resp.status_code == 200
    assert len(upload_resp.json()["images"]) == 1

    analyze_resp = client.post(f"/scans/{session_id}/analyze", headers=headers)
    assert analyze_resp.status_code == 202

    session_resp = client.get(f"/scans/{session_id}", headers=headers)
    assert session_resp.json()["status"] == "completed"

    report_resp = client.get(f"/scans/{session_id}/report", headers=headers)
    assert report_resp.status_code == 200
    report = report_resp.json()
    assert report["summary"] == "테스트 코멘트"
    assert exercise_id in report["recommended_exercise_ids"]
    # symmetry_score는 AI 추정이 아니라 MediaPipe 실측 기반이라 실제 포즈 인식 결과에서 채워져야 함
    assert report["headline_stats"]["symmetry_score"] is not None

    list_resp = client.get("/scans", headers=headers)
    assert len(list_resp.json()) == 1

    delete_resp = client.delete(f"/scans/{session_id}", headers=headers)
    assert delete_resp.status_code == 200
    assert client.get(f"/scans/{session_id}", headers=headers).status_code == 404


def test_scan_pipeline_daily_quota_exceeded(client, monkeypatch, signup):
    token = _signup_and_consent(client, signup)
    headers = {"Authorization": f"Bearer {token}"}

    def fake_analyze(db, image_bytes, pose_summary, goal_text, goal_image_bytes=None, category=None, is_minor=False, lang="ko"):
        raise vision_service.DailyQuotaExceeded()

    monkeypatch.setattr(vision_service, "analyze_body_image", fake_analyze)

    create_resp = client.post("/scans", json={"category": "upper"}, headers=headers)
    session_id = create_resp.json()["id"]

    with open(FIXTURE_IMAGE, "rb") as f:
        client.post(
            f"/scans/{session_id}/images?angle=back",
            headers=headers,
            files={"file": ("sample.jpg", f, "image/jpeg")},
        )

    client.post(f"/scans/{session_id}/analyze", headers=headers)

    session_resp = client.get(f"/scans/{session_id}", headers=headers)
    assert session_resp.json()["status"] == "failed"
    assert "한도" in session_resp.json()["error_message"]

    report_resp = client.get(f"/scans/{session_id}/report", headers=headers)
    assert report_resp.status_code == 404


def test_upload_blocked_without_consent(client, signup):
    resp = signup("noconsent@example.com", "1995-01-01")
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post("/scans", json={"category": "upper"}, headers=headers)
    session_id = create_resp.json()["id"]

    with open(FIXTURE_IMAGE, "rb") as f:
        upload_resp = client.post(
            f"/scans/{session_id}/images?angle=back",
            headers=headers,
            files={"file": ("sample.jpg", f, "image/jpeg")},
        )
    assert upload_resp.status_code == 403


def test_scan_requests_retake_when_no_pose_detected(client, monkeypatch, signup):
    token = _signup_and_consent(client, signup)
    headers = {"Authorization": f"Bearer {token}"}

    def fail_if_called(*args, **kwargs):
        raise AssertionError("포즈 인식 실패 시 Gemini를 호출하면 안 됨")

    monkeypatch.setattr(vision_service, "analyze_body_image", fail_if_called)

    create_resp = client.post("/scans", json={"category": "upper"}, headers=headers)
    session_id = create_resp.json()["id"]

    with open(NO_PERSON_IMAGE, "rb") as f:
        client.post(
            f"/scans/{session_id}/images?angle=front",
            headers=headers,
            files={"file": ("no_person.jpg", f, "image/jpeg")},
        )

    client.post(f"/scans/{session_id}/analyze", headers=headers)

    session_resp = client.get(f"/scans/{session_id}", headers=headers)
    assert session_resp.json()["status"] == "failed"
    assert "다시 촬영" in session_resp.json()["error_message"]


def test_goal_alignment_reduce_skips_hypertrophy_and_stores_feedback(client, monkeypatch, signup):
    """목표(슬림) 방향이면 reduce 부위엔 근비대 운동을 추천하지 않고 유산소를 넣으며,
    goal_comparison에 일치율/방향/피드백이 저장된다."""
    token = _signup_and_consent(client, signup, email="goalalign@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    db = _get_test_session(client)
    chest_ex = Exercise(
        external_id="test-bench",
        name_en="Bench Press",
        primary_muscles=["chest"],
        secondary_muscles=[],
        source=ExerciseSource.curated,
    )
    cardio_ex = Exercise(
        external_id="test-run",
        name_en="Running",
        primary_muscles=[],
        secondary_muscles=[],
        source=ExerciseSource.curated,
        category="cardio",
    )
    db.add_all([chest_ex, cardio_ex])
    db.commit()
    chest_id = str(chest_ex.id)
    cardio_id = str(cardio_ex.id)
    db.close()

    # 슬림 목표 설정
    client.post("/goals", json={"goal_text": "슬림하고 탄탄한 몸"}, headers=headers)

    def fake_analyze(db, image_bytes, pose_summary, goal_text, goal_image_bytes=None, category=None, is_minor=False, lang="ko"):
        return {
            "body_part_assessment": {"chest": "목표 대비 과함"},
            "weak_points": [
                {"part": "chest", "severity": "high", "goal_action": "reduce", "comment": "가슴 볼륨을 줄이세요"},
            ],
            "overall_comment": "테스트 코멘트",
            "goal_alignment": {
                "sync_rate": 55,
                "direction": "slim_down",
                "feedback": "목표 대비 상체가 과합니다. 유산소를 늘리세요.",
            },
            "headline_stats": {"percentile": 30, "body_fat_estimate_pct": 12, "is_estimate": True},
        }

    monkeypatch.setattr(vision_service, "analyze_body_image", fake_analyze)

    session_id = client.post("/scans", json={"category": "upper"}, headers=headers).json()["id"]
    with open(FIXTURE_IMAGE, "rb") as f:
        client.post(
            f"/scans/{session_id}/images?angle=front",
            headers=headers,
            files={"file": ("sample.jpg", f, "image/jpeg")},
        )
    client.post(f"/scans/{session_id}/analyze", headers=headers)

    report = client.get(f"/scans/{session_id}/report", headers=headers).json()
    # reduce 부위(가슴)는 근비대 운동으로 추천되지 않는다.
    assert chest_id not in report["recommended_exercise_ids"]
    # 슬림 방향이므로 유산소가 추가된다.
    assert cardio_id in report["recommended_exercise_ids"]
    # 목표 비교 데이터 저장 확인.
    gc = report["goal_comparison"]
    assert gc["sync_rate"] == 55
    assert gc["direction"] == "slim_down"
    assert "유산소" in gc["feedback"]
    assert report["headline_stats"]["sync_rate"] == 55


def test_scan_explicit_content_warns_and_strikes(client, monkeypatch, signup):
    """노골적 이미지 감지 시 분석 실패 + 경고문 노출 + 스트라이크 누적."""
    from app.models.user import User

    token = _signup_and_consent(client, signup, email="explicit@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    def fake_analyze(db, image_bytes, pose_summary, goal_text, goal_image_bytes=None, category=None, is_minor=False, lang="ko"):
        raise vision_service.ExplicitContentDetected()

    monkeypatch.setattr(vision_service, "analyze_body_image", fake_analyze)

    create_resp = client.post("/scans", json={"category": "upper"}, headers=headers)
    session_id = create_resp.json()["id"]

    with open(FIXTURE_IMAGE, "rb") as f:
        client.post(
            f"/scans/{session_id}/images?angle=back",
            headers=headers,
            files={"file": ("sample.jpg", f, "image/jpeg")},
        )

    client.post(f"/scans/{session_id}/analyze", headers=headers)

    session_resp = client.get(f"/scans/{session_id}", headers=headers)
    assert session_resp.json()["status"] == "failed"
    assert "부적절한 이미지" in session_resp.json()["error_message"]

    db = client.TestingSessionLocal()
    user = db.query(User).filter(User.email == "explicit@example.com").first()
    assert user.nsfw_strike_count == 1
    assert user.is_banned is False
    db.close()
