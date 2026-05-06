from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

# Look for .env in backend/ first, then in the parent discord-comvis/ directory
_here = Path(__file__).parent
_env_candidates = [_here / ".env", _here.parent / ".env"]
_env_file = next((str(p) for p in _env_candidates if p.exists()), str(_here / ".env"))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_file, env_file_encoding="utf-8", extra="ignore")

    discord_bot_token: str = ""
    gemini_api_key: str = ""

    # Database — set DATABASE_URL to postgresql+asyncpg://... on Railway
    # Fallback to local SQLite for development
    database_url: str = "sqlite+aiosqlite:///./data/discord_comvis.db"

    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    # CORS — add Vercel frontend URL here
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Auth
    jwt_secret: str = "change-me-in-production-railway"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24
    admin_password: str = "Test2525"     # write operations
    viewer_password: str = "LookSys555"  # read-only

    # Slow Route coefficients
    slow_alpha: float = 0.35
    slow_beta: float = 0.25
    slow_gamma: float = 0.25
    slow_delta: float = 0.15
    slow_lambda_default: float = 0.10
    slow_lambda_incident: float = 0.05
    slow_lambda_casual: float = 0.30

    # Thresholds
    edge_confidence_threshold: float = 0.30
    open_socket_timeout_hours: int = 48

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
