import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.models import *  # noqa: E402,F401,F403


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    # app.db.SessionLocal과, 그걸 직접 import해 쓰는 모듈들(BackgroundTasks용 analysis_orchestrator)
    # 양쪽 다 테스트 DB를 보도록 패치해야 한다.
    monkeypatch.setattr("app.db.SessionLocal", TestingSessionLocal)
    monkeypatch.setattr("app.services.analysis_orchestrator.SessionLocal", TestingSessionLocal)
    monkeypatch.setattr("app.api.oauth.SessionLocal", TestingSessionLocal)

    storage_root = tmp_path / "storage"
    storage_root.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("app.services.storage_service.storage_service.root", storage_root)

    test_client = TestClient(app)
    test_client.TestingSessionLocal = TestingSessionLocal
    yield test_client


@pytest.fixture()
def signup(client, monkeypatch):
    """Google OAuth 가입을 흉내내 complete-signup 응답을 돌려주는 헬퍼.

    (비밀번호 가입은 제거되었으므로 모든 테스트는 이 경로로 계정을 만든다.)
    """
    from urllib.parse import parse_qs, urlparse

    from app.core.security import create_oauth_state_token
    from app.services import oauth_providers

    def _signup(email, birth_date="1995-01-01", external_id=None):
        external_id = external_id or f"ext-{email}"
        monkeypatch.setattr(
            oauth_providers,
            "complete_oauth_login",
            lambda provider, code: oauth_providers.OAuthUserInfo(
                provider=provider, external_id=external_id, email=email
            ),
        )
        callback = client.get(
            "/auth/oauth/google/callback",
            params={"code": "abc", "state": create_oauth_state_token("google")},
            follow_redirects=False,
        )
        query = parse_qs(urlparse(callback.headers["location"]).query)
        if "pending" not in query:
            # 이미 존재하는 계정이면 바로 로그인 토큰이 온다.
            return callback
        return client.post(
            "/auth/oauth/complete-signup",
            json={
                "pending_token": query["pending"][0],
                "birth_date": birth_date,
                "accept_terms": True,
                "accept_privacy": True,
            },
        )

    return _signup
