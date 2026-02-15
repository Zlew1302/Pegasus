# Pegasus — Projektregeln

## Stack
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0 async, SQLite (aiosqlite), Pydantic v2
- Frontend: Next.js 16 (App Router), TypeScript strict, Tailwind CSS, SWR, Recharts, Lucide
- Agent System: Anthropic Claude API, custom BaseAgent ABC, tool-use loop, SSE streaming
- Package Manager: pnpm (frontend), pip (backend, venv at .venv/)
- Runtime: Node 20 (Homebrew), Python 3.12 (Homebrew)
- PATH: `/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`

## Architektur-Prinzipien
- Deutsche Benutzeroberfläche, Dark Mode only
- DB-Schema via `Base.metadata.create_all` beim Start + Alembic-Migrationen für Änderungen
- Single-User-Modus (DEFAULT_USER_ID = "default-user" in `app/auth.py`)
- Alle Backend-Router unter `/api/` Prefix
- SSE (Server-Sent Events) für Echtzeit-Agent-Updates
- Services: Business-Logik gehört in `backend/app/services/`, NICHT in Router
- Router sind dünn: Validierung + Service-Aufruf + Response

## Python-Regeln
- Python 3.12 Syntax: type hints mit `X | None` statt `Optional[X]` bei neuen Dateien
- SQLAlchemy: `mapped_column()` Stil, `Mapped[T]` Typ-Annotationen
- Pydantic: `ConfigDict(from_attributes=True)` statt `class Config: orm_mode`
- Datetime: IMMER `datetime.now(UTC)` statt `datetime.utcnow()`
- UUIDs: `str(uuid4())` für alle Primärschlüssel (String(36))
- Async: Alle DB-Operationen async (async_sessionmaker, AsyncSession)
- Imports: Relative Imports innerhalb app/, absolute für agents/
- Error Messages: Deutsch in HTTP-Responses an Frontend
- Logging: `logging.getLogger(__name__)`, strukturiert via middleware.py

## TypeScript-Regeln
- `"use client"` Directive für alle Komponenten mit State/Effects
- SWR-Pattern: `useSWR<Type>(path, fetcher)` für Daten-Fetching
- API-Calls: `apiFetch<T>(path, options)` aus `@/lib/api` — NIEMALS direkte `fetch()` Aufrufe mit absolutem URL
- Keine `any` Typen — immer exakte Interfaces in `types/index.ts`
- Lucide Icons, keine anderen Icon-Libraries
- Tailwind-Klassen, keine CSS Modules, keine styled-components
- Deutsch für alle UI-Labels und Placeholder

## Datenbankmodelle
- Primärschlüssel: immer `String(36)` mit UUID
- Timestamps: `server_default=func.now()` für created_at
- ForeignKey: explizit mit `ForeignKey("table.column")`
- Indexes: `__table_args__` Tuple mit `Index()` Einträgen
- Neue Modelle IMMER in `backend/app/models/__init__.py` importieren

## Agent-System
- Neue Agents: BaseAgent ableiten, `run()` implementieren
- In `agents/registry.py` `AGENT_REGISTRY` registrieren
- Tools: BaseTool ABC, `execute(parameters, ToolContext) -> str`
- In `agents/tools/registry.py` mit `register_tool()` registrieren
- Tool-Ergebnisse: Max 10.000 Zeichen (truncation in base.py)
- TaskBriefing: Alle Agent-Konfiguration über `agents/briefing.py`

## Tests
- pytest + pytest-asyncio
- In-memory SQLite: `sqlite+aiosqlite:///:memory:`
- conftest.py: dependency override für get_db
- TESTING=1 Env-Var: deaktiviert Rate Limiting
- Test-Dateien: `backend/tests/test_<feature>.py`
- Mindestens: CRUD, 404-Handling, Validierung pro Router

## Sicherheit
- Keine Secrets in Code oder Logs
- ANTHROPIC_API_KEY nur via .env
- Tool-Ergebnisse werden truncated (10KB max)
- Rate Limiting: 200/min allgemein, 30/min für Agent-Endpoints
- Error-Handler: Keine Stack-Traces an Client (middleware.py)
- Input-Validierung durch Pydantic Schemas

## Performance
- Batch-Inserts bei Massen-Operationen
- Indexes für häufig gefilterte Spalten
- Lazy-Loading für schwere Module (sentence-transformers)
- Token-Budget-System für Context Injection
- DB-Sessions: Kurzlebig, commit + close

## Docker-Deployment
- Deployment: `docker compose up -d --build` aus Projekt-Root
- Backend-Dockerfile: `backend/Dockerfile`, Frontend: `frontend/Dockerfile`
- DB-Volume: `./backend/data/pegasus.db` (persistent über Rebuilds)
- Migrations: `backend/migrate.py` läuft automatisch vor Server-Start
- **Nach Backend-Änderungen**: IMMER `docker compose up -d --build` ausführen
- **Nach Frontend-Änderungen**: IMMER `docker compose up -d --build` ausführen
- **Docker-Cache bereinigen** bei unerklärlichem Verhalten: `docker compose down && docker compose build --no-cache && docker compose up -d`
- **Alte Container/Images aufräumen**: `docker system prune -f` nach größeren Rebuilds
- NIEMALS altes Frontend/Backend im Container lassen — bei Code-Änderungen IMMER neu bauen
- Neue Python-Dependencies: SOWOHL in `pyproject.toml` ALS AUCH in `backend/requirements.txt` eintragen
- Neue Alembic-Migrationen: `backend/migrations/versions/` — idempotent mit `_column_exists()` Guards
- Storage-Key-Versioning: Bei Layout-Änderungen `STORAGE_KEY` in `use-dashboard-layout.ts` hochzählen

## Verbotene Patterns
- KEIN `datetime.utcnow()` (deprecated)
- KEIN `class Config: orm_mode = True` (Pydantic v1 Syntax)
- KEINE synchronen DB-Calls
- KEIN `print()` für Logging (immer logger)
- KEINE relativen Imports aus agents/ in backend/
- KEIN setState im Render-Body (React: useEffect verwenden)
- KEIN direktes `fetch("http://localhost:8000/...")` im Frontend (immer `/api/` Prefix via apiFetch)
- KEINE ASCII-Ersetzungen für Umlaute (immer ä/ö/ü/ß, NIEMALS ae/oe/ue/ss)
