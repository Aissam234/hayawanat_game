from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    environment: str = "development"

    # Database
    database_url: str = "postgresql://hayawanat:hayawanat_secret@postgres:5432/hayawanat_db"

    # Security
    secret_key: str = "change-me-in-production"

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "allow"

    def model_post_init(self, __context):
        if self.environment == "production" and self.secret_key == "change-me-in-production":
            raise ValueError("SECRET_KEY must be changed in production environment")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
