from app.models.exercise import Exercise, ExerciseSource


def _signup(client, email="goaluser@example.com"):
    resp = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": "testpassword123",
            "birth_date": "1995-01-01",
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_goal_set_and_get_active(client):
    headers = _signup(client)
    resp = client.post("/goals", json={"goal_text": "역삼각형 몸"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["goal_text"] == "역삼각형 몸"

    resp2 = client.post("/goals", json={"goal_text": "어깨가 넓은 몸"}, headers=headers)
    assert resp2.status_code == 200

    active = client.get("/goals/active", headers=headers)
    assert active.json()["goal_text"] == "어깨가 넓은 몸"


def test_progress_log_create_and_list(client):
    headers = _signup(client, "progressuser@example.com")
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
