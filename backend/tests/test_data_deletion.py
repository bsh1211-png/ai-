"""동의 철회 / 회원 탈퇴 시 신체 사진이 실제로 삭제되는지 검증."""

from pathlib import Path

import pytest

from app.models.scan import BodyScanImage, BodyScanSession
from app.models.user import User
from app.services.storage_service import storage_service

FIXTURE_IMAGE = Path(__file__).parent / "fixtures" / "sample_body.jpg"


def _signup_consent(client, signup, email: str) -> dict:
    resp = signup(email, "1995-01-01")
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    client.post("/consents/body-image", json={"consented": True}, headers=headers)
    return headers


def _create_session_with_image(client, headers) -> str:
    sid = client.post("/scans", json={"category": "upper"}, headers=headers).json()["id"]
    with open(FIXTURE_IMAGE, "rb") as f:
        client.post(
            f"/scans/{sid}/images?angle=back",
            headers=headers,
            files={"file": ("sample.jpg", f, "image/jpeg")},
        )
    return sid


def _user_image_paths(client, email: str) -> list[str]:
    db = client.TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        rows = (
            db.query(BodyScanImage.storage_path)
            .join(BodyScanSession)
            .filter(BodyScanSession.user_id == user.id)
            .all()
        )
        return [r.storage_path for r in rows]
    finally:
        db.close()


def test_revoke_consent_deletes_stored_media(client, signup):
    email = "revokemedia@example.com"
    headers = _signup_consent(client, signup, email)
    _create_session_with_image(client, headers)

    paths = _user_image_paths(client, email)
    assert len(paths) == 1
    assert storage_service.read_bytes(paths[0])  # 파일이 실제로 존재

    resp = client.delete("/consents/body-image", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["deleted_photos"] == 1

    # 스캔 목록이 비고, 물리 파일도 삭제됨
    assert client.get("/scans", headers=headers).json() == []
    with pytest.raises(Exception):
        storage_service.read_bytes(paths[0])
    assert _user_image_paths(client, email) == []


def test_delete_account_removes_media_and_blocks_access(client, signup):
    email = "deleteacct@example.com"
    headers = _signup_consent(client, signup, email)
    _create_session_with_image(client, headers)

    paths = _user_image_paths(client, email)
    assert len(paths) == 1

    resp = client.delete("/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["deleted_photos"] == 1

    # 탈퇴 후 접근 차단
    assert client.get("/auth/me", headers=headers).status_code == 401
    # 물리 파일 삭제
    with pytest.raises(Exception):
        storage_service.read_bytes(paths[0])

    # PII 익명화 + 탈퇴 처리
    db = client.TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is None  # 원래 이메일로는 더 이상 조회되지 않음
    finally:
        db.close()
