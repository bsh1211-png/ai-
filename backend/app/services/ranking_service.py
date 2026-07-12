"""친구 대결/랭킹 로직.

점수는 최신 분석의 "상위 X%(percentile)"를 '높을수록 우세한 스코어'로 환산한다:
    score = 100 - percentile   (상위 5% -> 95점)
친구에게는 닉네임과 점수만 공개하며 신체 사진·이메일은 절대 노출하지 않는다.
"""

import secrets
import uuid

from sqlalchemy.orm import Session

from app.models.scan import AnalysisReport, BodyScanSession
from app.models.user import Friendship, User

# 헷갈리는 문자(0/O, 1/I) 제외한 초대 코드용 알파벳
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 7
_DEFAULT_NAME = "익명의 도전자"


class InviteCodeInvalid(Exception):
    pass


class CannotFriendSelf(Exception):
    pass


def latest_score(db: Session, user_id: uuid.UUID) -> tuple[int | None, int | None]:
    """가장 최근 분석 리포트의 (score, percentile). 분석 기록이 없으면 (None, None)."""
    report = (
        db.query(AnalysisReport)
        .join(BodyScanSession, AnalysisReport.session_id == BodyScanSession.id)
        .filter(BodyScanSession.user_id == user_id)
        .order_by(AnalysisReport.created_at.desc())
        .first()
    )
    if report is None or not report.headline_stats:
        return None, None
    percentile = report.headline_stats.get("percentile")
    if percentile is None:
        return None, None
    percentile = int(percentile)
    score = max(1, min(99, 100 - percentile))
    return score, percentile


def _generate_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))


def get_or_create_invite_code(db: Session, user: User) -> str:
    if user.invite_code:
        return user.invite_code
    for _ in range(10):
        code = _generate_code()
        if db.query(User.id).filter(User.invite_code == code).first() is None:
            user.invite_code = code
            db.commit()
            return code
    raise RuntimeError("초대 코드 생성에 실패했습니다")


def connect_by_code(db: Session, current_user: User, code: str) -> User:
    """초대 코드로 친구 연결. 양방향 레코드를 생성한다(멱등)."""
    normalized = code.strip().upper()
    owner = (
        db.query(User)
        .filter(User.invite_code == normalized, User.deleted_at.is_(None))
        .first()
    )
    if owner is None:
        raise InviteCodeInvalid()
    if owner.id == current_user.id:
        raise CannotFriendSelf()

    already = (
        db.query(Friendship)
        .filter(Friendship.user_id == current_user.id, Friendship.friend_id == owner.id)
        .first()
    )
    if already is None:
        db.add(Friendship(user_id=current_user.id, friend_id=owner.id))
        db.add(Friendship(user_id=owner.id, friend_id=current_user.id))
        db.commit()
    return owner


def leaderboard(db: Session, current_user: User) -> list[dict]:
    """나 + 친구들의 점수를 높은 순으로 정렬한 리더보드.

    미성년자 보호: 미성년 이용자는 신체 점수 경쟁에 참여하지 않는다.
    (본인은 빈 리더보드, 미성년 친구의 점수도 남의 리더보드에 노출하지 않는다.)
    """
    if current_user.is_minor:
        return []

    friend_ids = [
        row.friend_id
        for row in db.query(Friendship.friend_id).filter(Friendship.user_id == current_user.id).all()
    ]
    user_ids = [current_user.id, *friend_ids]
    users = db.query(User).filter(User.id.in_(user_ids), User.is_minor.is_(False)).all()

    entries = []
    for u in users:
        score, percentile = latest_score(db, u.id)
        entries.append(
            {
                "user_id": str(u.id),
                "display_name": u.display_name or _DEFAULT_NAME,
                "is_me": u.id == current_user.id,
                "score": score,
                "percentile": percentile,
            }
        )

    # 점수 높은 순 -> 점수 없는 사람은 맨 뒤 -> 이름순
    entries.sort(key=lambda e: (e["score"] is None, -(e["score"] or 0), e["display_name"]))

    rank = 0
    for e in entries:
        if e["score"] is not None:
            rank += 1
            e["rank"] = rank
        else:
            e["rank"] = None
    return entries
