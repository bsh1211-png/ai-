from pathlib import Path

from app.models.exercise import Exercise, ExerciseSource
from app.services import vision_service

FIXTURE_IMAGE = Path(__file__).parent / "fixtures" / "sample_body.jpg"


def _signup(signup, email="goaluser@example.com"):
    resp = signup(email, "1995-01-01")
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_goal_set_and_get_active(client, signup):
    headers = _signup(signup)
    resp = client.post("/goals", json={"goal_text": "역삼각형 몸"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["goal_text"] == "역삼각형 몸"

    resp2 = client.post("/goals", json={"goal_text": "어깨가 넓은 몸"}, headers=headers)
    assert resp2.status_code == 200

    active = client.get("/goals/active", headers=headers)
    assert active.json()["goal_text"] == "어깨가 넓은 몸"
    assert active.json()["id"] == resp.json()["id"]  # 같은 row를 갱신해야 함


def test_goal_text_update_preserves_reference_image(client, monkeypatch, signup):
    headers = _signup(signup, "goalpreserve@example.com")
    goal = client.post("/goals", json={"goal_text": "초기 목표"}, headers=headers).json()

    monkeypatch.setattr(vision_service, "describe_goal_image", lambda db, image_bytes, lang="ko": "")
    with open(FIXTURE_IMAGE, "rb") as f:
        client.post(
            f"/goals/{goal['id']}/reference-image",
            headers=headers,
            data={"consent": "true"},
            files={"file": ("wannabe.jpg", f, "image/jpeg")},
        )

    updated = client.post("/goals", json={"goal_text": "텍스트만 수정"}, headers=headers).json()
    assert updated["id"] == goal["id"]
    assert updated["goal_text"] == "텍스트만 수정"
    assert updated["reference_image_path"] is not None
    assert updated["goal_type"] == "combined"


def test_progress_log_create_and_list(client, signup):
    headers = _signup(signup, "progressuser@example.com")
    resp = client.post(
        "/progress", json={"weight_kg": 72.5, "notes": "테스트 기록"}, headers=headers
    )
    assert resp.status_code == 201

    list_resp = client.get("/progress", headers=headers)
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["weight_kg"] == 72.5


def test_list_exercises_filter_by_muscle(client):
    db = client.TestingSessionLocal()
    db.add(
        Exercise(
            external_id="ex1",
            name_en="Pull Up",
            primary_muscles=["lats"],
            secondary_muscles=["biceps"],
            source=ExerciseSource.curated,
        )
    )
    db.add(
        Exercise(
            external_id="ex2",
            name_en="Squat",
            primary_muscles=["quadriceps"],
            secondary_muscles=[],
            source=ExerciseSource.curated,
        )
    )
    db.commit()
    db.close()

    resp = client.get("/exercises", params={"muscle": "lats"})
    assert resp.status_code == 200
    names = [e["name_en"] for e in resp.json()]
    assert names == ["Pull Up"]

    resp_all = client.get("/exercises")
    assert len(resp_all.json()) == 2


def test_goal_reference_image_adjusts_goal_text(client, monkeypatch, signup):
    headers = _signup(signup, "goalimage@example.com")
    goal = client.post("/goals", json={"goal_text": "원래 목표"}, headers=headers).json()

    monkeypatch.setattr(
        vision_service, "describe_goal_image", lambda db, image_bytes, lang="ko": "어깨 넓고 허리 가는 역삼각형 체형"
    )

    with open(FIXTURE_IMAGE, "rb") as f:
        resp = client.post(
            f"/goals/{goal['id']}/reference-image",
            headers=headers,
            data={"consent": "true"},
            files={"file": ("wannabe.jpg", f, "image/jpeg")},
        )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["goal_text"] == "어깨 넓고 허리 가는 역삼각형 체형"
    assert updated["goal_type"] == "combined"
    assert updated["reference_image_consent"] is True


def test_goal_reference_image_requires_consent(client, signup):
    headers = _signup(signup, "goalnoconsent@example.com")
    goal = client.post("/goals", json={"goal_text": "목표"}, headers=headers).json()

    with open(FIXTURE_IMAGE, "rb") as f:
        resp = client.post(
            f"/goals/{goal['id']}/reference-image",
            headers=headers,
            data={"consent": "false"},
            files={"file": ("wannabe.jpg", f, "image/jpeg")},
        )
    assert resp.status_code == 400


def test_progress_log_delete(client, signup):
    headers = _signup(signup, "progressdelete@example.com")
    log = client.post("/progress", json={"weight_kg": 70.0}, headers=headers).json()

    delete_resp = client.delete(f"/progress/{log['id']}", headers=headers)
    assert delete_resp.status_code == 200

    list_resp = client.get("/progress", headers=headers)
    assert list_resp.json() == []


def test_progress_log_delete_blocks_other_users(client, signup):
    headers_a = _signup(signup, "progressowner@example.com")
    headers_b = _signup(signup, "progressother@example.com")
    log = client.post("/progress", json={"weight_kg": 70.0}, headers=headers_a).json()

    delete_resp = client.delete(f"/progress/{log['id']}", headers=headers_b)
    assert delete_resp.status_code == 404
