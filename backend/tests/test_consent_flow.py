def _signup(client, email, birth_date, guardian_email=None):
    payload = {
        "email": email,
        "password": "testpassword123",
        "birth_date": birth_date,
        "accept_terms": True,
        "accept_privacy": True,
    }
    if guardian_email:
        payload["guardian_email"] = guardian_email
    return client.post("/auth/signup", json=payload)


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_adult_signup_and_consent_flow(client):
    resp = _signup(client, "adult@example.com", "1995-01-01")
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_minor"] is False
    assert body["guardian_consent_dev_token"] is None
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


def test_signup_rejects_under_14(client):
    resp = _signup(client, "kid@example.com", "2018-01-01")
    assert resp.status_code == 400


def test_minor_requires_guardian_consent_before_upload(client):
    resp = _signup(client, "teen@example.com", "2012-01-01", guardian_email="guardian@example.com")
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_minor"] is True
    guardian_token = body["guardian_consent_dev_token"]
    assert guardian_token

    token = body["access_token"]
    client.post("/consents/body-image", json={"consented": True}, headers=_auth_headers(token))

    status_resp = client.get("/consents/me", headers=_auth_headers(token))
    assert status_resp.json()["can_upload"] is False
    assert "법정대리인" in status_resp.json()["blocked_reason"]

    confirm_resp = client.post("/consents/guardian/confirm", json={"token": guardian_token})
    assert confirm_resp.status_code == 200

    status_resp = client.get("/consents/me", headers=_auth_headers(token))
    assert status_resp.json()["can_upload"] is True


def test_login(client):
    _signup(client, "login@example.com", "1990-01-01")
    resp = client.post(
        "/auth/login", json={"email": "login@example.com", "password": "testpassword123"}
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()

    bad_resp = client.post(
        "/auth/login", json={"email": "login@example.com", "password": "wrongpassword"}
    )
    assert bad_resp.status_code == 401


def test_revoke_body_image_consent_blocks_upload(client):
    resp = _signup(client, "revoke@example.com", "1990-01-01")
    token = resp.json()["access_token"]
    client.post("/consents/body-image", json={"consented": True}, headers=_auth_headers(token))
    assert client.get("/consents/me", headers=_auth_headers(token)).json()["can_upload"] is True

    revoke_resp = client.delete("/consents/body-image", headers=_auth_headers(token))
    assert revoke_resp.status_code == 200

    assert client.get("/consents/me", headers=_auth_headers(token)).json()["can_upload"] is False
