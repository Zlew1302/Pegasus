"""Seed only essential system data — agent types and user profile."""

from sqlalchemy import select

from app.auth import DEFAULT_USER_ID
from app.database import async_session
from app.models.agent import AgentType
from app.models.user import UserProfile


RESEARCH_AGENT_ID = "agent-research-001"
PLANNING_AGENT_ID = "agent-planning-001"
CODE_AGENT_ID = "agent-code-001"

RESEARCH_SYSTEM_PROMPT = """Du bist ein erfahrener Research Agent im CrewBoard-System.
Deine Aufgabe ist es, gruendliche Recherchen durchzufuehren und strukturierte Berichte zu erstellen.

Richtlinien:
- Arbeite systematisch und gruendlich
- Bewerte Quellen kritisch
- Strukturiere Ergebnisse klar in Markdown
- Antworte immer auf Deutsch
- Sei praezise und faktenbasiert
- Nutze klare Ueberschriften und Aufzaehlungen
- Belege Behauptungen mit Quellen wenn moeglich"""


async def seed_essentials():
    """Seed only agent types and user profile. Skips if already present."""
    async with async_session() as session:
        # Check if already seeded
        result = await session.execute(
            select(AgentType).where(AgentType.id == RESEARCH_AGENT_ID)
        )
        if result.scalar_one_or_none():
            return

        # ── Agent Types (required for agent system) ──────────────
        session.add(AgentType(
            id=RESEARCH_AGENT_ID,
            name="Research Agent",
            avatar="bot",
            description="Fuehrt gruendliche Recherchen durch und erstellt strukturierte Berichte mit Quellenangaben.",
            capabilities='["web_research", "summarization", "analysis", "comparison"]',
            tools='["web_search"]',
            system_prompt=RESEARCH_SYSTEM_PROMPT,
            model="claude-sonnet-4-20250514",
            temperature=0.3,
            max_tokens=4096,
            max_concurrent_instances=5,
            trust_level="propose",
            is_custom=False,
        ))

        session.add(AgentType(
            id=PLANNING_AGENT_ID,
            name="Planning Agent",
            avatar="bot",
            description="Zerlegt komplexe Aufgaben in strukturierte Teilaufgaben mit Abhaengigkeiten und Zeitschaetzungen.",
            capabilities='["task_decomposition", "planning", "estimation", "dependency_analysis"]',
            tools='["read_project_context", "manage_task"]',
            system_prompt="Du bist ein erfahrener Projektplaner. Zerlege komplexe Aufgaben in ueberschaubare Teilaufgaben.",
            model="claude-sonnet-4-20250514",
            temperature=0.2,
            max_tokens=4096,
            max_concurrent_instances=5,
            trust_level="propose",
            is_custom=False,
        ))

        session.add(AgentType(
            id=CODE_AGENT_ID,
            name="Code Agent",
            avatar="bot",
            description="Schreibt und refaktorisiert Code, erstellt Tests und dokumentiert Aenderungen.",
            capabilities='["code_generation", "refactoring", "testing", "documentation"]',
            tools='["read_file", "write_file", "run_tests"]',
            system_prompt="Du bist ein erfahrener Softwareentwickler. Schreibe sauberen, getesteten Code.",
            model="claude-sonnet-4-20250514",
            temperature=0.1,
            max_tokens=8192,
            max_concurrent_instances=3,
            trust_level="propose",
            is_custom=False,
        ))

        # ── User Profile ─────────────────────────────────────────
        session.add(UserProfile(
            id=DEFAULT_USER_ID,
            display_name="Lukas",
            global_system_prompt="Antworte immer auf Deutsch. Sei praezise und faktenbasiert.",
        ))

        await session.commit()
        print("System-Daten (Agent-Typen + Profil) eingefuegt.")
