"""Lightweight DB migration script for Docker startup.

Runs Alembic migrations if the alembic_version table exists,
otherwise stamps the current head (for databases created via create_all).
All migration scripts use _column_exists() guards so they're idempotent.
"""

import os
import sqlite3
import sys


def get_db_path() -> str:
    """Extract SQLite file path from DATABASE_URL."""
    url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./data/crewboard.db")
    # URL format: sqlite+aiosqlite:///./data/crewboard.db
    path = url.split("///", 1)[-1] if "///" in url else "./data/crewboard.db"
    return path


def main():
    db_path = get_db_path()

    if not os.path.exists(db_path):
        print(f"[migrate] Database {db_path} does not exist yet — skipping migration (create_all will handle it)")
        return

    # Check if alembic_version table exists
    conn = sqlite3.connect(db_path)
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'")
    has_alembic = cursor.fetchone() is not None

    if not has_alembic:
        print("[migrate] No alembic_version table — applying column additions directly")
        # Add provider columns if they don't exist
        existing = {row[1] for row in conn.execute("PRAGMA table_info(agent_types)").fetchall()}

        if "provider" not in existing:
            conn.execute("ALTER TABLE agent_types ADD COLUMN provider VARCHAR(50) NOT NULL DEFAULT 'anthropic'")
            print("[migrate] Added column: agent_types.provider")

        if "provider_base_url" not in existing:
            conn.execute("ALTER TABLE agent_types ADD COLUMN provider_base_url VARCHAR(500)")
            print("[migrate] Added column: agent_types.provider_base_url")

        conn.commit()
        conn.close()
        print("[migrate] Direct migration complete")
    else:
        conn.close()
        print("[migrate] alembic_version table found — running alembic upgrade head")
        from alembic.config import Config
        from alembic import command
        cfg = Config("alembic.ini")
        # Override URL from env
        db_url = os.environ.get("DATABASE_URL")
        if db_url:
            cfg.set_main_option("sqlalchemy.url", db_url)
        command.upgrade(cfg, "head")
        print("[migrate] Alembic migration complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[migrate] Warning: Migration failed ({e}), continuing startup...")
        sys.exit(0)  # Don't block startup on migration failure
