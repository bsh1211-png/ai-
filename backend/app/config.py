from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "physique-analysis-api"
    environment: str = "development"
    database_url: str = "sqlite:///./dev.db"

    class Config:
        env_file = ".env"


settings = Settings()
