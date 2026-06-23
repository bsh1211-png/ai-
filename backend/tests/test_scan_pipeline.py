from pathlib import Path

from app.models.exercise import Exercise, ExerciseSource
from app.services import vision_service

FIXTURE_IMAGE = Path(__file__).parent / "fixtures" / "sample_body.jpg"


def _signup_and_consent(client) -> str:
    resp = client.post(
        "/auth/signup",
        json={
            "email": "scanuser@example.com",
            "password": "testpassword123",
            "birth_date": "1995-01-01",
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/consents/body-image", json={"consented": True}, headers=headers)
    return token


def _get_test_session(client):
    return client.TestingSessionLocal()


def test_full_scan_pipeline_success(client, monkeypatch):
    token = _signup_and_consent(client)
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

    def fake_analyze(db, image_bytes, pose_summary, goal_text):
        return {
            "body_part_assessment": {"lats": "성장 여지가 있습니다"},
            "weak_points": [{"part": "lats", "severity": "medium", "comment": "등 근육 발달에 집중해보세요"}],
            "overall_comment": "테스트 코멘트",
        }

    monkeypatch.setattr(vision_service, "analyze_body_image", fake_analyze)

    create_resp = client.post("/scans", json={"category": "upper_back"}, headers=headers)
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

    list_resp = client.get("/scans", headers=headers)
    assert len(list_resp.json()) == 1

    delete_resp = client.delete(f"/scans/{session_id}", headers=headers)
    assert delete_resp.status_code == 200
    assert client.get(f"/scans/{session_id}", headers=headers).status_code == 404


def test_scan_pipeline_daily_quota_exceeded(client, monkeypatch):
    token = _signup_and_consent(client)
    headers = {"Authorization": f"Bearer {token}"}

    def fake_analyze(db, image_bytes, pose_summary, goal_text):
        raise vision_service.DailyQuotaExceeded()

    monkeypatch.setattr(vision_service, "analyze_body_image", fake_analyze)

    create_resp = client.post("/scans", json={"category": "upper_back"}, headers=headers)
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


def test_upload_blocked_without_consent(client):
    resp = client.post(
        "/auth/signup",
        json={
            "email": "noconsent@example.com",
            "password": "testpassword123",
            "birth_date": "1995-01-01",
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post("/scans", json={"category": "upper_back"}, headers=headers)
    session_id = create_resp.json()["id"]

    with open(FIXTURE_IMAGE, "rb") as f:
        upload_resp = client.post(
            f"/scans/{session_id}/images?angle=back",
            headers=headers,
            files={"file": ("sample.jpg", f, "image/jpeg")},
        )
    assert upload_resp.status_code == 403
