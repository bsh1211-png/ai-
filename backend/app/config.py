from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "physique-analysis-api"
    environment: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
