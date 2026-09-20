from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, overridable via environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "Room Management API"
    API_V1_PREFIX: str = ""

    # Auth
    SECRET_KEY: str = "change-me-in-production-please-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Database
    DATABASE_URL: str = "sqlite:///./room.db"

    # Seed admin credentials
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # ID / supporting documents uploaded against a booking (images or PDFs)
    UPLOAD_DIR: str = "./uploads"
    MAX_DOCUMENT_BYTES: int = 10 * 1024 * 1024
    MAX_DOCUMENTS_PER_BOOKING: int = 10


settings = Settings()
