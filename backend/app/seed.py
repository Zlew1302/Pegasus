"""Seed data for CrewBoard — realistic demo data for all dashboard widgets"""

import asyncio
import random
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.database import async_session
from app.models.agent import AgentInstance, AgentType
from app.models.approval import Approval
from app.models.document import Block, Document
from app.models.execution import ExecutionStep
from app.models.notification import Notification
from app.models.project import Project
from app.models.task import Task, TaskHistory
from app.models.team import Team, TeamMember
from app.models.user import UserProfile, UserTodo


RESEARCH_AGENT_ID = "agent-research-001"
PLANNING_AGENT_ID = "agent-planning-001"
CODE_AGENT_ID = "agent-code-001"
SAMPLE_PROJECT_ID = "project-sample-001"
PROJECT_2_ID = "project-sample-002"
PROJECT_3_ID = "project-sample-003"

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

        now = datetime.now(UTC)

        # ── Agent Types ────────────────────────────────────────────
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

        # ── Projects ───────────────────────────────────────────────
        session.add(Project(
            id=SAMPLE_PROJECT_ID,
            title="CrewBoard Entwicklung",
            description="Entwicklung des CrewBoard PM-Tools mit KI-Agenten Integration.",
            goal="Ein funktionierendes MVP mit Kanban Board, Research Agent und Approval-Flow.",
            status="active",
            phase="Phase C",
            start_date=now - timedelta(days=30),
            end_date=now + timedelta(days=60),
            budget_cents=15000,
        ))

        session.add(Project(
            id=PROJECT_2_ID,
            title="Marketing Website Relaunch",
            description="Kompletter Relaunch der Unternehmens-Website mit neuem Design und CMS.",
            goal="Moderne, schnelle Website mit 50% mehr Leads.",
            status="active",
            phase="Phase B",
            start_date=now - timedelta(days=14),
            end_date=now + timedelta(days=45),
            budget_cents=8000,
        ))

        session.add(Project(
            id=PROJECT_3_ID,
            title="API-Dokumentation",
            description="Vollstaendige API-Dokumentation mit Beispielen und SDK-Guides.",
            goal="Jeder Endpoint dokumentiert, alle SDKs mit Quickstart-Guide.",
            status="planning",
            phase="Phase A",
            start_date=now - timedelta(days=3),
            end_date=now + timedelta(days=30),
            budget_cents=3000,
        ))

        # ── Tasks (across projects) ────────────────────────────────
        task_data = [
            # CrewBoard tasks (10)
            (SAMPLE_PROJECT_ID, "Backend Skeleton aufsetzen", "done", "high", 0),
            (SAMPLE_PROJECT_ID, "Frontend Skeleton aufsetzen", "done", "high", 1),
            (SAMPLE_PROJECT_ID, "Dashboard implementieren", "done", "high", 2),
            (SAMPLE_PROJECT_ID, "Kanban Board bauen", "done", "medium", 3),
            (SAMPLE_PROJECT_ID, "Block-Editor entwickeln", "done", "high", 4),
            (SAMPLE_PROJECT_ID, "Agent-System integrieren", "in_progress", "critical", 5),
            (SAMPLE_PROJECT_ID, "Approval-Flow implementieren", "in_progress", "high", 6),
            (SAMPLE_PROJECT_ID, "SSE Streaming einbauen", "review", "medium", 7),
            (SAMPLE_PROJECT_ID, "Profil-Seite erstellen", "todo", "medium", 8),
            (SAMPLE_PROJECT_ID, "E2E Tests schreiben", "backlog", "low", 9),
            # Marketing tasks (5)
            (PROJECT_2_ID, "Design-Konzept erstellen", "done", "high", 0),
            (PROJECT_2_ID, "Wireframes abstimmen", "done", "high", 1),
            (PROJECT_2_ID, "Frontend-Entwicklung", "in_progress", "critical", 2),
            (PROJECT_2_ID, "CMS Integration", "todo", "high", 3),
            (PROJECT_2_ID, "Content Migration", "backlog", "medium", 4),
            # API Docs tasks (3)
            (PROJECT_3_ID, "Endpoint-Inventar erstellen", "in_progress", "high", 0),
            (PROJECT_3_ID, "OpenAPI Spec generieren", "todo", "medium", 1),
            (PROJECT_3_ID, "SDK Beispiele schreiben", "backlog", "medium", 2),
        ]

        task_ids = []
        for pid, title, status, priority, order in task_data:
            tid = f"seed-task-{len(task_ids)+1:03d}"
            session.add(Task(
                id=tid,
                project_id=pid,
                title=title,
                status=status,
                priority=priority,
                sort_order=order,
            ))
            task_ids.append((tid, status, pid))

        # ── Task History (generates productivity data) ─────────────
        done_tasks = [(tid, pid) for tid, status, pid in task_ids if status == "done"]
        for i, (tid, pid) in enumerate(done_tasks):
            days_ago = random.randint(0, 13)
            session.add(TaskHistory(
                id=f"seed-hist-{i+1:03d}",
                task_id=tid,
                changed_by_type="human",
                field_name="status",
                old_value="review",
                new_value="done",
                changed_at=now - timedelta(days=days_ago, hours=random.randint(1, 12)),
            ))

        # ── Agent Instances (for activity feed) ───────────────────
        session.add(AgentInstance(
            id="seed-inst-001",
            agent_type_id=RESEARCH_AGENT_ID,
            task_id=task_ids[0][0],
            status="completed",
            progress_percent=100,
            started_at=now - timedelta(hours=5),
            completed_at=now - timedelta(hours=4),
            total_cost_cents=18,
        ))
        session.add(AgentInstance(
            id="seed-inst-002",
            agent_type_id=CODE_AGENT_ID,
            task_id=task_ids[5][0],
            status="running",
            current_step="Code-Generierung",
            progress_percent=65,
            started_at=now - timedelta(minutes=15),
            total_cost_cents=8,
        ))
        session.add(AgentInstance(
            id="seed-inst-003",
            agent_type_id=PLANNING_AGENT_ID,
            task_id=task_ids[6][0],
            status="waiting_input",
            current_step="Warte auf Genehmigung",
            progress_percent=40,
            started_at=now - timedelta(hours=1),
            total_cost_cents=5,
        ))
        session.add(AgentInstance(
            id="seed-inst-004",
            agent_type_id=RESEARCH_AGENT_ID,
            task_id=task_ids[10][0],
            status="completed",
            progress_percent=100,
            started_at=now - timedelta(hours=2),
            completed_at=now - timedelta(hours=1, minutes=30),
            total_cost_cents=12,
        ))

        # ── Execution Steps (cost data spanning 14 days) ──────────
        step_counter = 0
        for day_offset in range(14):
            day = now - timedelta(days=day_offset)
            num_steps = random.randint(1, 5)
            for _ in range(num_steps):
                step_counter += 1
                inst_id = random.choice(["seed-inst-001", "seed-inst-004"])
                session.add(ExecutionStep(
                    id=f"seed-step-{step_counter:03d}",
                    agent_instance_id=inst_id,
                    step_number=step_counter,
                    step_type="llm_call",
                    description=f"Verarbeitung Schritt {step_counter}",
                    model="claude-sonnet-4-20250514",
                    tokens_in=random.randint(500, 2000),
                    tokens_out=random.randint(200, 1200),
                    cost_cents=random.randint(2, 15),
                    started_at=day - timedelta(hours=random.randint(1, 12)),
                    completed_at=day - timedelta(hours=random.randint(0, 1)),
                ))

        # ── User Profile ───────────────────────────────────────────
        session.add(UserProfile(
            id="default-user",
            display_name="Lukas",
            global_system_prompt="Antworte immer auf Deutsch. Sei praezise und faktenbasiert.",
        ))

        # ── Teams ──────────────────────────────────────────────────
        session.add(Team(id="seed-team-001", name="Engineering", description="Backend- und Frontend-Entwicklung"))
        session.add(Team(id="seed-team-002", name="Design", description="UI/UX Design und Prototyping"))
        session.add(Team(id="seed-team-003", name="KI-Agenten", description="Agent-Entwicklung und -Training"))

        session.add(TeamMember(team_id="seed-team-001", member_type="human", member_id="default-user", role="lead"))
        session.add(TeamMember(team_id="seed-team-001", member_type="agent", member_id=CODE_AGENT_ID, role="member"))
        session.add(TeamMember(team_id="seed-team-003", member_type="agent", member_id=RESEARCH_AGENT_ID, role="member"))
        session.add(TeamMember(team_id="seed-team-003", member_type="agent", member_id=PLANNING_AGENT_ID, role="member"))
        session.add(TeamMember(team_id="seed-team-002", member_type="human", member_id="default-user", role="member"))

        # ── Todos ──────────────────────────────────────────────────
        todos = [
            ("Dashboard Widgets testen", False),
            ("API-Keys einrichten", False),
            ("Research Agent ausprobieren", False),
            ("Deployment Pipeline aufsetzen", False),
            ("Code Review fuer Agent-System", True),
            ("Seed-Daten erweitern", True),
        ]
        for i, (title, done) in enumerate(todos):
            session.add(UserTodo(
                id=f"seed-todo-{i+1:03d}",
                title=title,
                sort_order=i,
                is_completed=done,
            ))

        # ── Notifications ──────────────────────────────────────────
        session.add(Notification(
            id="seed-notif-001",
            type="agent_completed",
            priority="normal",
            title="Research Agent fertig",
            message="Die Recherche zu 'Backend Skeleton aufsetzen' wurde abgeschlossen.",
            link=f"/projects/{SAMPLE_PROJECT_ID}",
            is_read=False,
            created_at=now - timedelta(hours=4),
        ))
        session.add(Notification(
            id="seed-notif-002",
            type="approval_needed",
            priority="high",
            title="Genehmigung erforderlich",
            message="Planning Agent wartet auf deine Freigabe fuer den Aufgabenplan.",
            link=f"/projects/{SAMPLE_PROJECT_ID}",
            is_read=False,
            created_at=now - timedelta(hours=1),
        ))
        session.add(Notification(
            id="seed-notif-003",
            type="task_assigned",
            priority="normal",
            title="Neue Aufgabe zugewiesen",
            message="'CMS Integration' wurde dir zugewiesen.",
            link=f"/projects/{PROJECT_2_ID}",
            is_read=False,
            created_at=now - timedelta(minutes=30),
        ))
        session.add(Notification(
            id="seed-notif-004",
            type="agent_completed",
            priority="normal",
            title="Research Agent fertig",
            message="Recherche zum Marketing-Website Design-Konzept abgeschlossen.",
            link=f"/projects/{PROJECT_2_ID}",
            is_read=True,
            created_at=now - timedelta(hours=8),
        ))
        session.add(Notification(
            id="seed-notif-005",
            type="system",
            priority="low",
            title="System-Update",
            message="CrewBoard wurde auf Version 0.2 aktualisiert.",
            is_read=True,
            created_at=now - timedelta(days=1),
        ))

        # ── Approvals ─────────────────────────────────────────────
        session.add(Approval(
            id="seed-approval-001",
            task_id=task_ids[6][0],
            agent_instance_id="seed-inst-003",
            type="action_plan",
            status="pending",
            description="Aufgabenzerlegung fuer 'Approval-Flow implementieren' — 5 Teilaufgaben vorgeschlagen.",
            requested_at=now - timedelta(hours=1),
        ))
        session.add(Approval(
            id="seed-approval-002",
            task_id=task_ids[5][0],
            agent_instance_id="seed-inst-002",
            type="code_review",
            status="pending",
            description="Code-Review fuer Agent-System Integration — 3 neue Dateien.",
            requested_at=now - timedelta(minutes=10),
        ))

        # ── Documents ──────────────────────────────────────────────
        session.add(Document(id="seed-doc-001", project_id=SAMPLE_PROJECT_ID, title="Projektnotizen", icon="📋", is_pinned=True))
        session.add(Document(id="seed-doc-002", project_id=SAMPLE_PROJECT_ID, title="Architektur-Dokumentation", icon="🏗️", is_pinned=False))
        session.add(Document(id="seed-doc-003", project_id=PROJECT_2_ID, title="Design-Konzept v2", icon="🎨", is_pinned=True))
        session.add(Document(id="seed-doc-004", project_id=PROJECT_3_ID, title="API Endpoint Inventar", icon="📖", is_pinned=False))

        # Blocks
        seed_blocks = [
            ("seed-doc-001", "heading_1", "CrewBoard Projektnotizen", 0),
            ("seed-doc-001", "paragraph", "Dieses Dokument enthaelt alle wichtigen Notizen zur CrewBoard-Entwicklung.", 1),
            ("seed-doc-001", "heading_2", "Architektur-Entscheidungen", 2),
            ("seed-doc-001", "bullet_list", "Next.js 16 mit App Router fuer das Frontend", 3),
            ("seed-doc-001", "bullet_list", "FastAPI mit SQLAlchemy 2.0 async fuer das Backend", 4),
            ("seed-doc-001", "bullet_list", "SQLite als Datenbank (leichtgewichtig fuer MVP)", 5),
            ("seed-doc-001", "heading_2", "Offene Fragen", 6),
            ("seed-doc-001", "todo", "Agent-zu-Agent Kommunikation testen", 7),
            ("seed-doc-002", "heading_1", "Architektur-Dokumentation", 0),
            ("seed-doc-002", "paragraph", "Beschreibung der Systemarchitektur und Designentscheidungen.", 1),
            ("seed-doc-003", "heading_1", "Design-Konzept v2", 0),
            ("seed-doc-004", "heading_1", "API Endpoint Inventar", 0),
        ]
        for i, (doc_id, btype, content, order) in enumerate(seed_blocks):
            meta = '{"checked": false}' if btype == "todo" else None
            session.add(Block(
                id=f"seed-block-{i+1:03d}",
                document_id=doc_id,
                block_type=btype,
                content=content,
                sort_order=order,
                meta_json=meta,
            ))

        await session.commit()
        print("Seed-Daten erfolgreich eingefuegt.")


if __name__ == "__main__":
    asyncio.run(seed_database())
