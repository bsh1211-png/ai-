"""노골적 성적 이미지 업로드에 대한 스트라이크/밴 처리 공통 모듈."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.constants import NSFW_STRIKE_LIMIT
from app.models.user import User


def register_nsfw_strike(db: Session, user: User) -> tuple[int, bool]:
    """스트라이크 1회 누적. 한도 도달 시 영구 정지. (누적 횟수, 밴 여부)를 반환한다."""
    user.nsfw_strike_count = (user.nsfw_strike_count or 0) + 1
    banned = False
    if user.nsfw_strike_count >= NSFW_STRIKE_LIMIT:
        if user.banned_at is None:
            user.banned_at = datetime.now(timezone.utc)
        banned = True
    db.commit()
    return user.nsfw_strike_count, banned


def nsfw_warning_message(strikes: int, banned: bool) -> str:
    if banned:
        return (
            f"🚫 부적절한 이미지 업로드가 {NSFW_STRIKE_LIMIT}회 누적되어 "
            "계정 이용이 영구 정지되었습니다."
        )
    return (
        "⚠️ 부적절한 이미지가 감지되었습니다.\n"
        "체형 분석은 운동 부위가 보이는 사진이면 충분하며, 성기·성행위 등 노골적인 성적 "
        "콘텐츠가 포함된 사진은 분석할 수 없습니다.\n"
        f"(경고 {strikes}/{NSFW_STRIKE_LIMIT}회 — {NSFW_STRIKE_LIMIT}회 누적 시 계정이 영구 정지됩니다)"
    )
