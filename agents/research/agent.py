"""Research Agent — 5-step multi-step workflow."""

import time
from datetime import datetime

from agents.base import BaseAgent
from agents.research.prompts import (
    RESEARCH_SYSTEM_PROMPT,
    STEP_ANALYZE,
    STEP_PLAN,
    STEP_REPORT,
    STEP_RESEARCH,
    STEP_SYNTHESIZE,
)

STEPS = [
    {"name": "Aufgabe analysieren", "type": "analysis"},
    {"name": "Suchstrategie entwickeln", "type": "planning"},
    {"name": "Recherche durchfuehren", "type": "research"},
    {"name": "Ergebnisse bewerten", "type": "synthesis"},
    {"name": "Bericht erstellen", "type": "output"},
]

# Approximate cost per 1M tokens (Sonnet)
COST_PER_1M_INPUT = 300  # $3.00 = 300 cents
COST_PER_1M_OUTPUT = 1500  # $15.00 = 1500 cents


def estimate_cost_cents(tokens_in: int, tokens_out: int) -> int:
    return int(
        (tokens_in / 1_000_000 * COST_PER_1M_INPUT)
        + (tokens_out / 1_000_000 * COST_PER_1M_OUTPUT)
    )


class ResearchAgent(BaseAgent):
    async def run(self) -> str:
        total = len(STEPS)
        briefing = self.briefing

        criteria_section = ""
        if briefing.acceptance_criteria:
            criteria_section = f"Akzeptanzkriterien: {briefing.acceptance_criteria}"

        context_section = ""
        if briefing.project_goal:
            context_section = f"Projekt-Kontext: {briefing.project_title} — {briefing.project_goal}"

        # Step 1: Analyze task
        await self._start_step(1, total, STEPS[0])
        analysis = await self._call_claude(
            STEP_ANALYZE.format(
                title=briefing.task_title,
                description=briefing.task_description or "Keine Beschreibung",
                criteria_section=criteria_section,
                context_section=context_section,
            )
        )
        await self._complete_step(1, "Kernfragen identifiziert")

        # Step 2: Develop search strategy
        await self._start_step(2, total, STEPS[1])
        search_plan = await self._call_claude(
            STEP_PLAN.format(analysis=analysis)
        )
        await self._complete_step(2, "Suchstrategie erstellt")

        # Step 3: Conduct research
        await self._start_step(3, total, STEPS[2])
        research_results = await self._call_claude(
            STEP_RESEARCH.format(
                search_plan=search_plan,
                title=briefing.task_title,
            )
        )
        await self._complete_step(3, "Recherche abgeschlossen")

        # Step 4: Synthesize
        await self._start_step(4, total, STEPS[3])
        synthesis = await self._call_claude(
            STEP_SYNTHESIZE.format(
                research_results=research_results,
                title=briefing.task_title,
                criteria_section=criteria_section,
            )
        )
        await self._complete_step(4, "Synthese erstellt")

        # Step 5: Create report
        await self._start_step(5, total, STEPS[4])
        report = await self._call_claude(
            STEP_REPORT.format(
                title=briefing.task_title,
                description=briefing.task_description or "",
                synthesis=synthesis,
            )
        )
        await self._complete_step(5, "Bericht erstellt")

        return report

    async def _call_claude(self, user_message: str) -> str:
        """Call Claude API with streaming, emitting thought events."""
        await self._check_pause_cancel()

        start_time = time.time()
        accumulated = ""
        last_emit_len = 0

        async with self.client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=RESEARCH_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            async for text in stream.text_stream:
                accumulated += text
                # Emit thought fragments every ~150 chars
                if len(accumulated) - last_emit_len >= 150:
                    last_emit_len = len(accumulated)
                    await self.emit("thought", {
                        "text": accumulated[-300:],
                        "timestamp": datetime.utcnow().isoformat(),
                    })

        message = await stream.get_final_message()
        duration_ms = int((time.time() - start_time) * 1000)
        tokens_in = message.usage.input_tokens
        tokens_out = message.usage.output_tokens
        cost = estimate_cost_cents(tokens_in, tokens_out)

        await self._record_execution_step(
            step_type="llm_call",
            description=f"Claude API Call ({tokens_in}in/{tokens_out}out)",
            model="claude-sonnet-4-20250514",
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_cents=cost,
            duration_ms=duration_ms,
        )

        return accumulated

    async def _start_step(self, step: int, total: int, step_info: dict):
        await self._check_pause_cancel()
        progress = int((step - 1) / total * 100)
        await self._update_progress(progress, step_info["name"], total)
        await self.emit("step_start", {
            "step": step,
            "total_steps": total,
            "description": step_info["name"],
            "type": step_info["type"],
        })
        await self.emit("progress", {
            "percent": progress,
            "current_step": step,
            "total_steps": total,
        })

    async def _complete_step(self, step: int, summary: str):
        total = len(STEPS)
        progress = int(step / total * 100)
        await self._update_progress(progress, STEPS[step - 1]["name"], total)
        await self.emit("step_complete", {
            "step": step,
            "summary": summary[:200],
        })
        await self.emit("progress", {
            "percent": progress,
            "current_step": step,
            "total_steps": total,
        })
