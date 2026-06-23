import uuid
from datetime import date

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    birth_date: date
    accept_terms: bool
    accept_privacy: bool
    accept_marketing: bool = False
    guardian_email: EmailStr | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SignupResponse(TokenResponse):
    is_minor: bool
    guardian_consent_dev_token: str | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_minor: bool
    guardian_consent_status: str

    class Config:
        from_attributes = True
