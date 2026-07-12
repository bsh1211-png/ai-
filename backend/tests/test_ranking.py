"""친구 초대·랭킹 리더보드 테스트."""

from datetime import datetime, timezone

from app.models.scan import AnalysisReport, BodyScanSession, ScanCategory, ScanStatus
from app.models.user import User


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _give_score(client, email: str, percentile: int) -> None:
    """해당 사용자에게 완료된 분석 리포트(상위 percentile%)를 하나 만들어 준다."""
    db = client.TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        session = BodyScanSession(
            user_id=user.id,
            scan_date=datetime.now(timezone.utc),
            category=ScanCategory.full_body,
            status=ScanStatus.completed,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        db.add(
            AnalysisReport(
                session_id=session.id,
                summary="",
                weak_points=[],
                recommended_exercise_ids=[],
                headline_stats={"percentile": percentile},
            )
        )
        db.commit()
    finally:
        db.close()


def test_invite_accept_and_leaderboard_ranking(client, signup):
    ta = signup("a@example.com", external_id="a").json()["access_token"]
    tb = signup("b@example.com", external_id="b").json()["access_token"]

    code = client.get("/friends/me", headers=_headers(ta)).json()["invite_code"]
    assert code

    accept = client.post("/friends/accept", json={"code": code}, headers=_headers(tb))
    assert accept.status_code == 200

    # A 상위 10% -> 90점, B 상위 40% -> 60점
    _give_score(client, "a@example.com", 10)
    _give_score(client, "b@example.com", 40)

    board = client.get("/friends/leaderboard", headers=_headers(ta)).json()["entries"]
    assert len(board) == 2
    assert board[0]["is_me"] is True
    assert board[0]["score"] == 90 and board[0]["percentile"] == 10 and board[0]["rank"] == 1
    assert board[1]["is_me"] is False
    assert board[1]["score"] == 60 and board[1]["rank"] == 2

    # 친구 관계는 양방향 — B의 리더보드에도 A가 보인다
    board_b = client.get("/friends/leaderboard", headers=_headers(tb)).json()["entries"]
    assert {e["is_me"] for e in board_b} == {True, False}


def test_nickname_shows_on_leaderboard(client, signup):
    ta = signup("nick@example.com", external_id="nick").json()["access_token"]
    resp = client.post("/friends/nickname", json={"display_name": "헐크"}, headers=_headers(ta))
    assert resp.status_code == 200
    board = client.get("/friends/leaderboard", headers=_headers(ta)).json()["entries"]
    assert board[0]["display_name"] == "헐크"


def test_no_score_user_ranked_last_without_rank(client, signup):
    ta = signup("scored@example.com", external_id="s1").json()["access_token"]
    tb = signup("noscore@example.com", external_id="s2").json()["access_token"]
    code = client.get("/friends/me", headers=_headers(ta)).json()["invite_code"]
    client.post("/friends/accept", json={"code": code}, headers=_headers(tb))
    _give_score(client, "scored@example.com", 20)  # 80점

    board = client.get("/friends/leaderboard", headers=_headers(ta)).json()["entries"]
    assert board[0]["score"] == 80 and board[0]["rank"] == 1
    assert board[1]["score"] is None and board[1]["rank"] is None


def test_minor_excluded_from_ranking(client, signup):
    """미성년자 보호: 미성년 이용자는 신체 점수 랭킹에 노출/참여되지 않는다."""
    ta = signup("adult2@example.com", external_id="ad2").json()["access_token"]
    tm = signup("teen2@example.com", "2012-01-01", external_id="tn2").json()["access_token"]

    code = client.get("/friends/me", headers=_headers(ta)).json()["invite_code"]
    client.post("/friends/accept", json={"code": code}, headers=_headers(tm))

    _give_score(client, "adult2@example.com", 20)
    _give_score(client, "teen2@example.com", 5)  # 높은 점수여도 노출되면 안 됨

    # 성인 리더보드엔 미성년 친구가 없다 (본인만)
    board_a = client.get("/friends/leaderboard", headers=_headers(ta)).json()["entries"]
    assert len(board_a) == 1 and board_a[0]["is_me"] is True

    # 미성년자 본인은 빈 리더보드
    board_m = client.get("/friends/leaderboard", headers=_headers(tm)).json()["entries"]
    assert board_m == []


def test_accept_own_code_and_invalid_code(client, signup):
    ta = signup("self@example.com", external_id="self").json()["access_token"]
    code = client.get("/friends/me", headers=_headers(ta)).json()["invite_code"]
    assert client.post("/friends/accept", json={"code": code}, headers=_headers(ta)).status_code == 400
    assert client.post("/friends/accept", json={"code": "ZZZZZZZ"}, headers=_headers(ta)).status_code == 404
