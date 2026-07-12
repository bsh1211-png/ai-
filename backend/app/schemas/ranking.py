from pydantic import BaseModel


class RankingProfile(BaseModel):
    invite_code: str
    display_name: str | None
    score: int | None
    percentile: int | None


class NicknameRequest(BaseModel):
    display_name: str


class AcceptInviteRequest(BaseModel):
    code: str


class LeaderboardEntry(BaseModel):
    user_id: str
    display_name: str
    is_me: bool
    score: int | None
    percentile: int | None
    rank: int | None


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
