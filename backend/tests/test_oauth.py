from datetime import date
from urllib.parse import parse_qs, urlparse

from app.core.security import create_oauth_state_token
from app.models.user import OAuthProvider, User
from app.services import oauth_providers


def _state(provider="google"):
    return create_oauth_state_token(provider)


def test_oauth_start_not_configured_returns_400(client):
    resp = client.get("/auth/oauth/google/start", follow_redirects=False)
    assert resp.status_code == 400


def test_oauth_callback_invalid_state_redirects_with_error(client):
    resp = client.get(
        "/auth/oauth/google/callback",
        params={"code": "abc", "state": "not-a-real-token"},
        follow_redirects=False,
    )
    assert resp.status_code in (302, 307)
    query = parse_qs(urlparse(resp.headers["location"]).query)
    assert "error" in query


def test_oauth_callback_new_user_then_complete_signup(client, monkeypatch):
    monkeypatch.setattr(
        oauth_providers,
        "complete_oauth_login",
        lambda provider, code: oauth_providers.OAuthUserInfo(
            provider=provider, external_id="google-ext-1", email="newoauth@example.com"
        ),
    )

    resp = client.get(
        "/auth/oauth/google/callback",
        params={"code": "abc", "state": _state()},
        follow_redirects=False,
    )
    assert resp.status_code in (302, 307)
    query = parse_qs(urlparse(resp.headers["location"]).query)
    assert query["email"][0] == "newoauth@example.com"
    pending_token = query["pending"][0]

    complete_resp = client.post(
        "/auth/oauth/complete-signup",
        json={
            "pending_token": pending_token,
            "birth_date": "1995-01-01",
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    assert complete_resp.status_code == 201
    body = complete_resp.json()
    assert "access_token" in body
    assert body["is_minor"] is False


def test_oauth_callback_existing_oauth_user_logs_in_directly(client, monkeypatch):
    db = client.TestingSessionLocal()
    existing = User(
        email="existingoauth@example.com",
        password_hash=None,
        oauth_provider=OAuthProvider.google,
        oauth_id="google-ext-2",
        birth_date=date(1990, 1, 1),
        is_minor=False,
    )
    db.add(existing)
    db.commit()
    db.close()

    monkeypatch.setattr(
        oauth_providers,
        "complete_oauth_login",
        lambda provider, code: oauth_providers.OAuthUserInfo(
            provider=provider, external_id="google-ext-2", email="existingoauth@example.com"
        ),
    )

    resp = client.get(
        "/auth/oauth/google/callback",
        params={"code": "abc", "state": _state()},
        follow_redirects=False,
    )
    query = parse_qs(urlparse(resp.headers["location"]).query)
    assert "token" in query


def test_oauth_callback_links_existing_password_account(client, monkeypatch):
    signup_resp = client.post(
        "/auth/signup",
        json={
            "email": "linkme@example.com",
            "password": "testpassword123",
            "birth_date": "1990-01-01",
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    assert signup_resp.status_code == 201

    monkeypatch.setattr(
        oauth_providers,
        "complete_oauth_login",
        lambda provider, code: oauth_providers.OAuthUserInfo(
            provider=provider, external_id="kakao-ext-1", email="linkme@example.com"
        ),
    )

    resp = client.get(
        "/auth/oauth/kakao/callback",
        params={"code": "abc", "state": _state("kakao")},
        follow_redirects=False,
    )
    query = parse_qs(urlparse(resp.headers["location"]).query)
    assert "token" in query

    db = client.TestingSessionLocal()
    linked = db.query(User).filter(User.email == "linkme@example.com").first()
    assert linked.oauth_provider == OAuthProvider.kakao
    assert linked.oauth_id == "kakao-ext-1"
    db.close()
