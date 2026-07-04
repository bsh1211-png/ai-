import uuid
from datetime import date

from pydantic import BaseModel, EmailStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SignupResponse(TokenResponse):
    is_minor: bool


class OAuthCompleteSignupRequest(BaseModel):
    pending_token: str
    birth_date: date
    accept_terms: bool
    accept_privacy: bool
    accept_marketing: bool = False


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_minor: bool
    is_banned: bool

    class Config:
        from_attributes = True
