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

    storage_root = tmp_path / "storage"
    storage_root.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("app.services.storage_service.storage_service.root", storage_root)

    test_client = TestClient(app)
    test_client.TestingSessionLocal = TestingSessionLocal
    yield test_client
