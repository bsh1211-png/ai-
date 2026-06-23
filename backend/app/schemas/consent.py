from pydantic import BaseModel


class BodyImageConsentRequest(BaseModel):
    consented: bool


class GuardianConsentConfirmRequest(BaseModel):
    token: str


class ConsentStatusResponse(BaseModel):
    is_minor: bool
    guardian_consent_status: str
    body_image_consent_active: bool
    can_upload: bool
    blocked_reason: str | None = None
