from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "physique-analysis-api"
    environment: str = "development"
    database_url: str = "sqlite:///./dev.db"

    gemini_api_key: str = ""
    gemini_pro_model: str = "gemini-2.5-pro"
    gemini_flash_model: str = "gemini-2.5-flash"

    jwt_secret: str = "dev-only-insecure-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    youtube_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
