"""Seed data for CrewBoard v0.1"""

import asyncio
from uuid import uuid4

from sqlalchemy import select

from app.database import async_session
from app.models.agent import AgentType
from app.models.project import Project


RESEARCH_AGENT_ID = "agent-research-001"
SAMPLE_PROJECT_ID = "project-sample-001"

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


async def seed_database():
    async with async_session() as session:
        # Check if already seeded
        result = await session.execute(
            select(AgentType).where(AgentType.id == RESEARCH_AGENT_ID)
        )
        if result.scalar_one_or_none():
            print("Datenbank bereits befuellt.")
            return

        # Research Agent Type
        research_agent = AgentType(
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
        )
        session.add(research_agent)

        # Sample Project
        sample_project = Project(
            id=SAMPLE_PROJECT_ID,
            title="CrewBoard Entwicklung",
            description="Entwicklung des CrewBoard PM-Tools mit KI-Agenten Integration.",
            goal="Ein funktionierendes MVP mit Kanban Board, Research Agent und Approval-Flow.",
            status="active",
        )
        session.add(sample_project)

        await session.commit()
        print("Seed-Daten erfolgreich eingefuegt.")


if __name__ == "__main__":
    asyncio.run(seed_database())
