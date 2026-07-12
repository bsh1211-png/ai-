from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models.user import User
from app.schemas.ranking import (
    AcceptInviteRequest,
    LeaderboardResponse,
    NicknameRequest,
    RankingProfile,
)
from app.services import ranking_service

router = APIRouter(prefix="/friends", tags=["friends"])


@router.get("/me", response_model=RankingProfile)
def my_ranking_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RankingProfile:
    code = ranking_service.get_or_create_invite_code(db, current_user)
    score, percentile = ranking_service.latest_score(db, current_user.id)
    return RankingProfile(
        invite_code=code,
        display_name=current_user.display_name,
        score=score,
        percentile=percentile,
    )


@router.post("/nickname", status_code=status.HTTP_200_OK)
def set_nickname(
    payload: NicknameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    name = payload.display_name.strip()
    if not 1 <= len(name) <= 30:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="닉네임은 1~30자여야 합니다")
    current_user.display_name = name
    db.commit()
    return {"status": "ok", "display_name": name}


@router.post("/accept", status_code=status.HTTP_200_OK)
def accept_invite(
    payload: AcceptInviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        friend = ranking_service.connect_by_code(db, current_user, payload.code)
    except ranking_service.CannotFriendSelf as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="자기 자신은 친구로 추가할 수 없습니다"
        ) from error
    except ranking_service.InviteCodeInvalid as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="유효하지 않은 초대 코드입니다"
        ) from error
    return {"status": "connected", "friend_name": friend.display_name or "익명의 도전자"}


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeaderboardResponse:
    return LeaderboardResponse(entries=ranking_service.leaderboard(db, current_user))
