from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "swolemeter-api"
    environment: str = "development"
    database_url: str = "sqlite:///./dev.db"

    gemini_api_key: str = ""
    gemini_pro_model: str = "gemini-2.5-pro"
    gemini_flash_model: str = "gemini-2.5-flash"

    jwt_secret: str = "dev-only-insecure-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    youtube_api_key: str = ""

    backend_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:3000"

    # 추가 허용 Origin (콤마 구분, 예: https://swolemeter.vercel.app)
    extra_allowed_origins: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""

    # Supabase Storage (미설정 시 로컬 파일시스템 사용)
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_storage_bucket: str = "swolemeter-media"

    @property
    def allowed_origins(self) -> list[str]:
        origins = ["http://localhost:3000", self.frontend_base_url]
        if self.extra_allowed_origins:
            origins += [o.strip() for o in self.extra_allowed_origins.split(",") if o.strip()]
        return list(dict.fromkeys(origins))  # 중복 제거

    class Config:
        env_file = ".env"


settings = Settings()
