from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.models.user import OAuthProvider

PROVIDER_CONFIG = {
    OAuthProvider.google: {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
    },
}


class OAuthNotConfigured(Exception):
    pass


class OAuthEmailMissing(Exception):
    pass


@dataclass
class OAuthUserInfo:
    provider: OAuthProvider
    external_id: str
    email: str


def _redirect_uri(provider: OAuthProvider) -> str:
    return f"{settings.backend_base_url}/auth/oauth/{provider.value}/callback"


def build_authorize_url(provider: OAuthProvider, state: str) -> str:
    config = PROVIDER_CONFIG[provider]
    if not config["client_id"]:
        raise OAuthNotConfigured(f"{provider.value} OAuth가 설정되지 않았습니다 (client_id 없음)")

    params = {
        "client_id": config["client_id"],
        "redirect_uri": _redirect_uri(provider),
        "response_type": "code",
        "scope": config["scope"],
        "state": state,
    }
    return f"{config['authorize_url']}?{urlencode(params)}"


def _exchange_code_for_token(provider: OAuthProvider, code: str) -> str:
    config = PROVIDER_CONFIG[provider]
    data = {
        "grant_type": "authorization_code",
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "redirect_uri": _redirect_uri(provider),
        "code": code,
    }
    response = httpx.post(config["token_url"], data=data, timeout=10.0)
    response.raise_for_status()
    return response.json()["access_token"]


def _fetch_userinfo(provider: OAuthProvider, access_token: str) -> OAuthUserInfo:
    config = PROVIDER_CONFIG[provider]
    headers = {"Authorization": f"Bearer {access_token}"}
    response = httpx.get(config["userinfo_url"], headers=headers, timeout=10.0)
    response.raise_for_status()
    data = response.json()

    email = data.get("email")
    external_id = data.get("sub")

    if not email:
        raise OAuthEmailMissing(f"{provider.value} 계정에서 이메일 동의 정보를 가져오지 못했습니다")
    if not external_id:
        raise ValueError(f"{provider.value} 응답에서 사용자 식별자를 찾지 못했습니다")

    return OAuthUserInfo(provider=provider, external_id=external_id, email=email)


def complete_oauth_login(provider: OAuthProvider, code: str) -> OAuthUserInfo:
    access_token = _exchange_code_for_token(provider, code)
    return _fetch_userinfo(provider, access_token)
