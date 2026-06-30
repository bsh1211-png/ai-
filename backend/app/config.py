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

    google_client_id: str = ""
    google_client_secret: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
