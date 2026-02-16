"""Workflow Planning Agent — generates a structured project plan as JSON.

Unlike the regular PlanningAgent, this agent does NOT create tasks directly.
It returns structured JSON that the user can review and edit before confirmation.
"""

import json
import time
from datetime import datetime, UTC

from agents.base import BaseAgent
from agents.tools.registry import get_tools_for_agent
from agents.workflow_planning.prompts import (
    SYSTEM_PROMPT,
    STEP_ANALYZE,
    STEP_FORMAT,
    STEP_PLAN,
)

STEPS = [
    {"name": "Kontext analysieren", "type": "analysis"},
    {"name": "Aufgabenplan entwerfen", "type": "planning"},
    {"name": "Strukturierte Ausgabe erstellen", "type": "formatting"},
]


class WorkflowPlanningAgent(BaseAgent):
    async def run(self) -> str:
        total = len(STEPS)
        briefing = self.briefing
        sys_prompt = self.system_prompt or SYSTEM_PROMPT

        # Only use read_project_context and search_knowledge tools (no manage_task!)
        tools = get_tools_for_agent(briefing.tools_json)

        # Build context string from briefing
        context = f"Projekt: {briefing.project_title}\n"
        if briefing.project_goal:
            context += f"Ziel: {briefing.project_goal}\n"
        if briefing.task_description:
            context += f"\n{briefing.task_description}\n"

        # Step 1: Analyze context
        await self._start_step(1, total, STEPS[0])
        if tools:
            analysis = await self._call_claude_with_tools(
                STEP_ANALYZE.format(context=context),
                tools=tools,
                system=sys_prompt,
            )
        else:
            analysis = await self._call_claude(
                STEP_ANALYZE.format(context=context),
                system=sys_prompt,
            )
        await self._complete_step(1, "Kontext analysiert")

        # Step 2: Design task plan
        await self._start_step(2, total, STEPS[1])
        plan = await self._call_claude(
            STEP_PLAN.format(analysis=analysis),
            system=sys_prompt,
        )
        await self._complete_step(2, "Aufgabenplan entworfen")

        # Step 3: Format as structured JSON
        await self._start_step(3, total, STEPS[2])
        json_output = await self._call_claude(
            STEP_FORMAT.format(plan=plan),
            system=sys_prompt,
        )
        await self._complete_step(3, "Strukturierte Ausgabe erstellt")

        # Validate and clean the JSON output
        cleaned = self._extract_json(json_output)
        return cleaned

    def _extract_json(self, text: str) -> str:
        """Extract and validate JSON from the agent's output."""
        # Try to find JSON in the text
        # First try the raw text
        try:
            parsed = json.loads(text)
            return json.dumps(parsed, ensure_ascii=False)
        except json.JSONDecodeError:
            pass

        # Try to extract from markdown code block
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.index("```", start)
            try:
                parsed = json.loads(text[start:end].strip())
                return json.dumps(parsed, ensure_ascii=False)
            except (json.JSONDecodeError, ValueError):
                pass

        # Try to find JSON object in text
        brace_start = text.find("{")
        brace_end = text.rfind("}")
        if brace_start != -1 and brace_end != -1:
            try:
                parsed = json.loads(text[brace_start:brace_end + 1])
                return json.dumps(parsed, ensure_ascii=False)
            except json.JSONDecodeError:
                pass

        # Return a default structure if parsing fails
        return json.dumps({
            "tasks": [],
            "milestones": [],
            "summary": "Fehler beim Parsen der Agent-Ausgabe. Bitte erneut generieren.",
            "timeline_notes": None,
        }, ensure_ascii=False)

    async def _call_claude(self, user_message: str, system: str | None = None) -> str:
        """Call LLM with streaming (Anthropic) or fallback (other providers)."""
        await self._check_pause_cancel()

        sys_prompt = system or self.system_prompt or SYSTEM_PROMPT

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
