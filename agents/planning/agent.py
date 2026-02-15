"""Planning Agent — decomposes tasks into subtasks."""

import time
from datetime import datetime, UTC

from agents.base import BaseAgent
from agents.tools.registry import get_tools_for_agent
from agents.planning.prompts import (
    PLANNING_SYSTEM_PROMPT,
    STEP_ANALYZE,
    STEP_CREATE,
    STEP_DECOMPOSE,
    STEP_DEPENDENCIES,
)

STEPS = [
    {"name": "Aufgabe analysieren", "type": "analysis"},
    {"name": "Teilaufgaben identifizieren", "type": "decomposition"},
    {"name": "Abhaengigkeiten pruefen", "type": "dependencies"},
    {"name": "Arbeitsplan erstellen", "type": "creation"},
]


class PlanningAgent(BaseAgent):
    async def run(self) -> str:
        total = len(STEPS)
        briefing = self.briefing
        sys_prompt = self.system_prompt or PLANNING_SYSTEM_PROMPT

        tools = get_tools_for_agent(briefing.tools_json)

        criteria_section = ""
        if briefing.acceptance_criteria:
            criteria_section = f"Akzeptanzkriterien: {briefing.acceptance_criteria}"

        # Step 1: Analyze task with project context
        await self._start_step(1, total, STEPS[0])
        if tools:
            analysis = await self._call_claude_with_tools(
                STEP_ANALYZE.format(
                    title=briefing.task_title,
                    description=briefing.task_description or "Keine Beschreibung",
                    criteria_section=criteria_section,
                ),
                tools=tools,
                system=sys_prompt,
            )
        else:
            analysis = await self._call_claude(
                STEP_ANALYZE.format(
                    title=briefing.task_title,
                    description=briefing.task_description or "Keine Beschreibung",
                    criteria_section=criteria_section,
                ),
                system=sys_prompt,
            )
        await self._complete_step(1, "Aufgabe analysiert")

        # Step 2: Identify subtasks
        await self._start_step(2, total, STEPS[1])
        subtasks = await self._call_claude(
            STEP_DECOMPOSE.format(
                analysis=analysis,
                title=briefing.task_title,
            ),
            system=sys_prompt,
        )
        await self._complete_step(2, "Teilaufgaben identifiziert")

        # Step 3: Check dependencies
        await self._start_step(3, total, STEPS[2])
        plan = await self._call_claude(
            STEP_DEPENDENCIES.format(subtasks=subtasks),
            system=sys_prompt,
        )
        await self._complete_step(3, "Abhaengigkeiten geprueft")

        # Step 4: Create subtasks using tools
        await self._start_step(4, total, STEPS[3])
        if tools:
            result = await self._call_claude_with_tools(
                STEP_CREATE.format(plan=plan),
                tools=tools,
                system=sys_prompt,
            )
        else:
            result = plan
        await self._complete_step(4, "Arbeitsplan erstellt")

        # Build final report
        report = f"""# Arbeitsplan: {briefing.task_title}

## Analyse
{analysis[:500]}

## Teilaufgaben
{subtasks}

## Reihenfolge & Abhaengigkeiten
{plan}

## Ergebnis
{result}
"""
        return report

    async def _call_claude(self, user_message: str, system: str | None = None) -> str:
        """Call LLM with streaming (Anthropic) or fallback (other providers)."""
        await self._check_pause_cancel()

        sys_prompt = system or self.system_prompt or PLANNING_SYSTEM_PROMPT

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
