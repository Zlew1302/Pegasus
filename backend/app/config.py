import os

from pydantic_settings import BaseSettings


def _load_env_file_first() -> dict[str, str]:
    """Load .env file manually so empty env vars don't shadow real values."""
    overrides: dict[str, str] = {}
    try:
        from dotenv import dotenv_values

        env_vals = dotenv_values(".env")
        for key, val in env_vals.items():
            env_current = os.environ.get(key)
            # If env var is empty but .env has a value, use .env value
            if val and (env_current is None or env_current == ""):
                overrides[key] = val
    except ImportError:
        pass
    return overrides


class Settings(BaseSettings):
    ANTHROPIC_API_KEY: str = ""
    BRAVE_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    DATABASE_URL: str = "sqlite+aiosqlite:///./crewboard.db"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


# Pre-load .env values to override empty env vars
_overrides = _load_env_file_first()
for _k, _v in _overrides.items():
    os.environ[_k] = _v

settings = Settings()
