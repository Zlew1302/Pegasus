"""Writing Agent — multi-step content creation workflow."""

import time
from datetime import datetime, UTC

from agents.base import BaseAgent
from agents.tools.registry import get_tools_for_agent
from agents.writing.prompts import (
    WRITING_SYSTEM_PROMPT,
    STEP_ANALYZE,
    STEP_CONTEXT,
    STEP_DRAFT,
    STEP_OUTLINE,
    STEP_REVIEW,
)

STEPS = [
    {"name": "Projekt-Kontext laden", "type": "context"},
    {"name": "Aufgabe analysieren", "type": "analysis"},
    {"name": "Gliederung erstellen", "type": "planning"},
    {"name": "Text schreiben", "type": "writing"},
    {"name": "Selbst-Review", "type": "review"},
]


class WritingAgent(BaseAgent):
    async def run(self) -> str:
        total = len(STEPS)
        briefing = self.briefing
        sys_prompt = self.system_prompt or WRITING_SYSTEM_PROMPT

        tools = get_tools_for_agent(briefing.tools_json)

        criteria_section = ""
        if briefing.acceptance_criteria:
            criteria_section = f"Akzeptanzkriterien: {briefing.acceptance_criteria}"

        context_section = ""
        if briefing.project_goal:
            context_section = f"Projekt-Kontext: {briefing.project_title} — {briefing.project_goal}"

        # Step 1: Load project context
        await self._start_step(1, total, STEPS[0])
        if tools:
            project_context = await self._call_claude_with_tools(
                STEP_CONTEXT,
                tools=tools,
                system=sys_prompt,
            )
        else:
            project_context = context_section or "Kein Projekt-Kontext verfuegbar."
        await self._complete_step(1, "Projekt-Kontext geladen")

        # Step 2: Analyze task
        await self._start_step(2, total, STEPS[1])
        analysis = await self._call_claude(
            STEP_ANALYZE.format(
                title=briefing.task_title,
                description=briefing.task_description or "Keine Beschreibung",
                criteria_section=criteria_section,
                context_section=project_context[:1000],
            ),
            system=sys_prompt,
        )
        await self._complete_step(2, "Schreibaufgabe analysiert")

        # Step 3: Create outline
        await self._start_step(3, total, STEPS[2])
        outline = await self._call_claude(
            STEP_OUTLINE.format(analysis=analysis),
            system=sys_prompt,
        )
        await self._complete_step(3, "Gliederung erstellt")

        # Step 4: Write draft
        await self._start_step(4, total, STEPS[3])
        draft = await self._call_claude(
            STEP_DRAFT.format(
                title=briefing.task_title,
                outline=outline,
                context=project_context[:2000],
            ),
            system=sys_prompt,
        )
        await self._complete_step(4, "Entwurf geschrieben")

        # Step 5: Self-review and improve
        await self._start_step(5, total, STEPS[4])
        final = await self._call_claude(
            STEP_REVIEW.format(
                title=briefing.task_title,
                criteria_section=criteria_section,
                draft=draft[:6000],
            ),
            system=sys_prompt,
        )
        await self._complete_step(5, "Text fertiggestellt")

        return final

    async def _call_claude(self, user_message: str, system: str | None = None) -> str:
        """Call LLM with streaming (Anthropic) or fallback (other providers)."""
        await self._check_pause_cancel()

        sys_prompt = system or self.system_prompt or WRITING_SYSTEM_PROMPT

        # Non-Anthropic providers: use universal non-streaming call
        if not self.client:
            return await self._call_llm_simple(user_message, system=sys_prompt)

        start_time = time.time()
        accumulated = ""
        last_emit_len = 0

        async def _do_stream():
            nonlocal accumulated, last_emit_len
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=self.max_tokens,
                system=sys_prompt,
                messages=[{"role": "user", "content": user_message}],
            ) as stream:
                async for text in stream.text_stream:
                    accumulated += text
                    if len(accumulated) - last_emit_len >= 150:
                        last_emit_len = len(accumulated)
                        await self._append_thought(accumulated[-300:])
                        await self.emit("thought", {
                            "text": accumulated[-300:],
                            "timestamp": datetime.now(UTC).isoformat(),
                        })
            return await stream.get_final_message()

        message = await self._call_with_retry(lambda: _do_stream())
        duration_ms = int((time.time() - start_time) * 1000)
        tokens_in = message.usage.input_tokens
        tokens_out = message.usage.output_tokens
        cost = self._estimate_cost(tokens_in, tokens_out)

        await self._record_execution_step(
            step_type="llm_call",
            description=f"LLM Call ({tokens_in}in/{tokens_out}out)",
            model=self.model,
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
