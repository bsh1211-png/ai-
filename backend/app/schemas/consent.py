from pydantic import BaseModel


class BodyImageConsentRequest(BaseModel):
    consented: bool


class ConsentStatusResponse(BaseModel):
    is_minor: bool
    body_image_consent_active: bool
    can_upload: bool
    blocked_reason: str | None = None
