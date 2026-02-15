import os

from pydantic_settings import BaseSettings


def _find_env_file() -> str | None:
    """Search for .env file in current dir, parent dir, and project root."""
    candidates = [
        ".env",
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),  # backend/../.env (project root)
        os.path.join(os.path.dirname(__file__), "..", ".env"),  # backend/app/../.env
    ]
    for path in candidates:
        resolved = os.path.abspath(path)
        if os.path.isfile(resolved):
            return resolved
    return None


def _load_env_file_first() -> dict[str, str]:
    """Load .env file manually so empty env vars don't shadow real values."""
    overrides: dict[str, str] = {}
    try:
        from dotenv import dotenv_values

        env_path = _find_env_file()
        if not env_path:
            return overrides
        env_vals = dotenv_values(env_path)
        for key, val in env_vals.items():
            env_current = os.environ.get(key)
            # If env var is empty but .env has a value, use .env value
            if val and (env_current is None or env_current == ""):
                overrides[key] = val
    except ImportError:
        pass
    return overrides


# Absolute path to backend/ directory — ensures DB is always found
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_DEFAULT_DB_URL = f"sqlite+aiosqlite:///{os.path.join(_BACKEND_DIR, 'crewboard.db')}"


class Settings(BaseSettings):
    ANTHROPIC_API_KEY: str = ""
    BRAVE_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    DATABASE_URL: str = _DEFAULT_DB_URL
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": _find_env_file() or ".env", "env_file_encoding": "utf-8"}


# Pre-load .env values to override empty env vars
_overrides = _load_env_file_first()
for _k, _v in _overrides.items():
    os.environ[_k] = _v

settings = Settings()

# Fix relative DB paths from .env to absolute
if settings.DATABASE_URL.startswith("sqlite") and ":///./" in settings.DATABASE_URL:
    _rel_path = settings.DATABASE_URL.split(":///./", 1)[1]
    settings.DATABASE_URL = f"sqlite+aiosqlite:///{os.path.join(_BACKEND_DIR, _rel_path)}"
