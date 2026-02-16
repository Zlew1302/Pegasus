"""Seed only essential system data — agent types and user profile."""

from sqlalchemy import select

from app.auth import DEFAULT_USER_ID
from app.database import async_session
from app.models.agent import AgentType
from app.models.user import UserProfile


RESEARCH_AGENT_ID = "agent-research-001"
PLANNING_AGENT_ID = "agent-planning-001"
WRITING_AGENT_ID = "agent-writing-001"
QA_AGENT_ID = "agent-qa-001"
WORKFLOW_PLANNING_AGENT_ID = "agent-workflow-planning-001"
ORCHESTRATOR_AGENT_ID = "agent-orchestrator-001"

RESEARCH_SYSTEM_PROMPT = """Du bist ein erfahrener Research Agent im Pegasus-System.
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
    """Seed only agent types and user profile. Upserts new agents."""
    async with async_session() as session:
        # Check if already seeded (basic check)
        result = await session.execute(
            select(AgentType).where(AgentType.id == RESEARCH_AGENT_ID)
        )
        existing = result.scalar_one_or_none()

        # Ensure new agent types exist (even if old seed already ran)
        await _ensure_new_agents(session)
        # Remove deprecated Code Agent
        await _remove_deprecated_agents(session)

        if existing:
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
            id=WRITING_AGENT_ID,
            name="Writing Agent",
            avatar="bot",
            description="Erstellt hochwertige Texte, Dokumente und Berichte basierend auf Projekt-Kontext und Anforderungen.",
            capabilities='["content_creation", "copywriting", "documentation", "editing"]',
            tools='["read_project_context", "knowledge_search"]',
            system_prompt="Du bist ein erfahrener Texter. Erstelle hochwertige, gut strukturierte Texte auf Deutsch.",
            model="claude-sonnet-4-20250514",
            temperature=0.4,
            max_tokens=4096,
            max_concurrent_instances=5,
            trust_level="propose",
            is_custom=False,
        ))

        session.add(AgentType(
            id=QA_AGENT_ID,
            name="QA Agent",
            avatar="bot",
            description="Fuehrt Qualitaetssicherung durch: generiert Testfaelle, analysiert Risiken und erstellt QA-Reports.",
            capabilities='["test_generation", "quality_assurance", "risk_analysis", "documentation"]',
            tools='["read_project_context", "knowledge_search", "manage_task"]',
            system_prompt="Du bist ein erfahrener QA-Spezialist. Analysiere systematisch und gruendlich.",
            model="claude-sonnet-4-20250514",
            temperature=0.2,
            max_tokens=4096,
            max_concurrent_instances=5,
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


async def _ensure_new_agents(session):
    """Stellt sicher, dass neue Agent-Typen existieren (idempotent)."""
    new_agents = {
        WORKFLOW_PLANNING_AGENT_ID: {
            "name": "Workflow Planning Agent",
            "avatar": "bot",
            "description": "Erstellt strukturierte Arbeitspläne als JSON für den KI-Planungs-Workflow. Gibt Vorschläge zurück, die vom Benutzer reviewt werden.",
            "capabilities": '["project_planning", "task_decomposition", "agent_recommendation", "milestone_planning"]',
            "tools": '["read_project_context", "search_knowledge"]',
            "system_prompt": "Du bist ein erfahrener Projektplanungs-Experte. Erstelle strukturierte Arbeitspläne als JSON.",
            "model": "claude-sonnet-4-20250514",
            "temperature": 0.3,
            "max_tokens": 4096,
            "max_concurrent_instances": 3,
            "trust_level": "propose",
            "is_custom": False,
        },
        ORCHESTRATOR_AGENT_ID: {
            "name": "Orchestrator Agent",
            "avatar": "bot",
            "description": "Analysiert Aufgaben und delegiert sie automatisch an spezialisierte Sub-Agenten. Nutzt MCP-Integrationen für externe Tools.",
            "capabilities": '["task_analysis", "agent_delegation", "workflow_coordination", "mcp_integration"]',
            "tools": '["read_project_context", "search_knowledge", "manage_task", "web_search", "delegate_to_agent"]',
            "system_prompt": "Du bist der KI-Orchestrator. Analysiere Aufgaben und delegiere sie an die passenden Sub-Agenten.",
            "model": "claude-sonnet-4-20250514",
            "temperature": 0.3,
            "max_tokens": 8192,
            "max_concurrent_instances": 3,
            "trust_level": "propose",
            "is_custom": False,
        },
    }

    for agent_id, config in new_agents.items():
        result = await session.execute(
            select(AgentType).where(AgentType.id == agent_id)
        )
        if not result.scalar_one_or_none():
            session.add(AgentType(id=agent_id, **config))
            print(f"Neuer Agent-Typ '{config['name']}' eingefuegt.")

    await session.commit()


async def _remove_deprecated_agents(session):
    """Entfernt veraltete Agent-Typen (Code Agent ohne Implementierung)."""
    deprecated_ids = ["agent-code-001"]
    for agent_id in deprecated_ids:
        result = await session.execute(
            select(AgentType).where(AgentType.id == agent_id)
        )
        agent = result.scalar_one_or_none()
        if agent:
            await session.delete(agent)
            print(f"Veralteter Agent-Typ '{agent.name}' entfernt.")

    await session.commit()
