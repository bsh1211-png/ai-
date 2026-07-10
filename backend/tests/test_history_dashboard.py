from pathlib import Path

from app.services import vision_service

FIXTURE_IMAGE = Path(__file__).parent / "fixtures" / "sample_body.jpg"


def _signup_and_consent(client, signup, email="historyuser@example.com") -> dict:
    resp = signup(email, "1995-01-01")
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/consents/body-image", json={"consented": True}, headers=headers)
    return headers


def _complete_one_scan(client, headers, monkeypatch, category="upper"):
    def fake_analyze(db, image_bytes, pose_summary, goal_text, goal_image_bytes=None, category=None, is_minor=False):
        return {
            "body_part_assessment": {"lats": "코멘트"},
            "weak_points": [{"part": "lats", "severity": "low", "comment": "코멘트"}],
            "overall_comment": "테스트 코멘트",
            "headline_stats": {
                "percentile": 20,
                "sync_rate": None,
                "body_fat_estimate_pct": 15,
                "ab_definition_score": 5,
                "is_estimate": True,
            },
        }

    monkeypatch.setattr(vision_service, "analyze_body_image", fake_analyze)

    session = client.post("/scans", json={"category": category}, headers=headers).json()
    with open(FIXTURE_IMAGE, "rb") as f:
        client.post(
            f"/scans/{session['id']}/images?angle=front",
            headers=headers,
            files={"file": ("sample.jpg", f, "image/jpeg")},
        )
    client.post(f"/scans/{session['id']}/analyze", headers=headers)


def test_dashboard_summary_insufficient_data(client, monkeypatch, signup):
    headers = _signup_and_consent(client, signup)
    _complete_one_scan(client, headers, monkeypatch)

    resp = client.get("/history/dashboard-summary", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["has_enough_data"] is False


def test_dashboard_summary_success_and_cache(client, monkeypatch, signup):
    headers = _signup_and_consent(client, signup, "historyuser2@example.com")
    _complete_one_scan(client, headers, monkeypatch, category="upper")
    _complete_one_scan(client, headers, monkeypatch, category="lower")

    monkeypatch.setattr(vision_service, "generate_history_summary", lambda db, ctx: "종합 총평입니다")

    first = client.get("/history/dashboard-summary", headers=headers).json()
    assert first["has_enough_data"] is True
    assert first["summary"] == "종합 총평입니다"

    # 캐시된 값이 재사용되어야 하므로, Gemini 호출이 다시 실패하더라도 같은 값이 나와야 한다
    def fail(db, ctx):
        raise AssertionError("캐시가 있으면 다시 호출하면 안 됨")

    monkeypatch.setattr(vision_service, "generate_history_summary", fail)
    second = client.get("/history/dashboard-summary", headers=headers).json()
    assert second["summary"] == "종합 총평입니다"


def test_dashboard_summary_rate_limited_is_not_cached(client, monkeypatch, signup):
    headers = _signup_and_consent(client, signup, "historyuser3@example.com")
    _complete_one_scan(client, headers, monkeypatch, category="upper")
    _complete_one_scan(client, headers, monkeypatch, category="lower")

    def raise_rate_limited(db, ctx):
        raise vision_service.StillAnalyzing()

    monkeypatch.setattr(vision_service, "generate_history_summary", raise_rate_limited)
    first = client.get("/history/dashboard-summary", headers=headers).json()
    assert "많아" in first["summary"]

    # 실패는 캐싱되지 않아야 하므로, 다음 호출에서 다시 Gemini를 시도해 성공하면 그 값이 나와야 한다
    monkeypatch.setattr(vision_service, "generate_history_summary", lambda db, ctx: "회복 후 총평")
    second = client.get("/history/dashboard-summary", headers=headers).json()
    assert second["summary"] == "회복 후 총평"
