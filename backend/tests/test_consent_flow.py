from app.core.constants import NSFW_STRIKE_LIMIT
from app.models.user import User
from app.services import moderation


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_adult_signup_and_consent_flow(client, signup):
    resp = signup("adult@example.com", "1995-01-01")
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_minor"] is False
    token = body["access_token"]

    status_resp = client.get("/consents/me", headers=_auth_headers(token))
    assert status_resp.json()["can_upload"] is False
    assert status_resp.json()["blocked_reason"] == "카메라/신체사진 사용 동의가 필요합니다"

    consent_resp = client.post(
        "/consents/body-image", json={"consented": True}, headers=_auth_headers(token)
    )
    assert consent_resp.status_code == 201

    status_resp = client.get("/consents/me", headers=_auth_headers(token))
    assert status_resp.json()["can_upload"] is True


def test_signup_rejects_under_14(client, signup):
    resp = signup("kid@example.com", "2018-01-01")
    assert resp.status_code == 400


def test_minor_signs_up_without_guardian(client, signup):
    """법정대리인 절차는 제거됨 — 만 14~18세도 별도 동의 없이 가입/이용 가능."""
    resp = signup("teen@example.com", "2012-01-01")
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_minor"] is True
    token = body["access_token"]

    client.post("/consents/body-image", json={"consented": True}, headers=_auth_headers(token))
    status_resp = client.get("/consents/me", headers=_auth_headers(token))
    # 신체사진 동의만 하면 미성년자도 바로 업로드 가능
    assert status_resp.json()["can_upload"] is True


def test_revoke_body_image_consent_blocks_upload(client, signup):
    resp = signup("revoke@example.com", "1990-01-01")
    token = resp.json()["access_token"]
    client.post("/consents/body-image", json={"consented": True}, headers=_auth_headers(token))
    assert client.get("/consents/me", headers=_auth_headers(token)).json()["can_upload"] is True

    revoke_resp = client.delete("/consents/body-image", headers=_auth_headers(token))
    assert revoke_resp.status_code == 200

    assert client.get("/consents/me", headers=_auth_headers(token)).json()["can_upload"] is False


def test_nsfw_strike_accumulates_and_bans(client, signup):
    """노골적 이미지 스트라이크가 누적되고, 한도 도달 시 밴되며 이후 업로드가 차단된다."""
    resp = signup("nsfw@example.com", "1995-01-01")
    token = resp.json()["access_token"]
    headers = _auth_headers(token)

    db = client.TestingSessionLocal()
    user = db.query(User).filter(User.email == "nsfw@example.com").first()

    # 한도-1 회까지는 밴되지 않는다.
    for i in range(NSFW_STRIKE_LIMIT - 1):
        strikes, banned = moderation.register_nsfw_strike(db, user)
        assert strikes == i + 1
        assert banned is False

    # 한도 도달 시 밴.
    strikes, banned = moderation.register_nsfw_strike(db, user)
    assert strikes == NSFW_STRIKE_LIMIT
    assert banned is True
    assert user.is_banned is True
    db.close()

    # 밴된 사용자는 스캔 생성이 403으로 막힌다.
    create_resp = client.post("/scans", json={"category": "upper"}, headers=headers)
    assert create_resp.status_code == 403
