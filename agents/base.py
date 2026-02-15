"""Base agent class for all CrewBoard agents."""

import asyncio
import json
import time
from abc import ABC, abstractmethod
from datetime import datetime, UTC
from uuid import uuid4

from anthropic import RateLimitError, APIStatusError

# Also catch OpenAI errors if available
try:
    from openai import RateLimitError as OpenAIRateLimitError, APIStatusError as OpenAIAPIStatusError
except ImportError:
    OpenAIRateLimitError = None
    OpenAIAPIStatusError = None
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from agents.briefing import TaskBriefing
from agents.llm import create_llm_provider
from app.models.agent import AgentInstance
from app.models.approval import Approval
from app.models.execution import ExecutionStep
from app.models.output import TaskOutput
from app.models.task import Task
from app.services.notification_service import notify_approval_needed, notify_agent_completed
from app.sse.manager import SSEEvent, SSEManager


class BaseAgent(ABC):
    def __init__(
        self,
        instance_id: str,
        briefing: TaskBriefing,
        session_factory: async_sessionmaker[AsyncSession],
        sse_manager: SSEManager,
    ):
        self.instance_id = instance_id
        self.briefing = briefing
        self.session_factory = session_factory
        self.sse = sse_manager
        # Create LLM provider (supports Anthropic, OpenAI, Kimi, etc.)
        self.llm = create_llm_provider(
            provider=briefing.provider,
            model=briefing.model,
            api_key=briefing.provider_api_key,
            base_url=briefing.provider_base_url,
        )
        # Keep self.client for backward compatibility with existing agent code
        self.client = self.llm.client if hasattr(self.llm, 'client') else None
        self.cancelled = False
        self._paused = asyncio.Event()
        self._paused.set()  # Not paused by default
        self.messages: list[str] = []  # Human messages queue
        self._step_number = 0
        self._total_cost_cents = 0
        # Config from AgentType via briefing
        self.model = briefing.model
        self.temperature = briefing.temperature
        self.max_tokens = briefing.max_tokens
        self.system_prompt = briefing.system_prompt
        # Inject knowledge context into system prompt (if available)
        if briefing.additional_context:
            self.system_prompt = (
                (self.system_prompt or "") + "\n\n" + briefing.additional_context
            )
        # Thought log persistence
        self._thought_entries: list[dict] = []
        self._thought_flush_count = 0
        # Decision Tracks
        self._track_sequence_index = 0

    async def emit(self, event_type: str, data: dict):
        await self.sse.emit(self.instance_id, SSEEvent(event=event_type, data=data))

    async def _call_llm_simple(
        self,
        user_message: str,
        system: str | None = None,
    ) -> str:
        """Call LLM (any provider) without streaming. Universal replacement for _call_claude.

        Returns the text response. Also records execution step and cost.
        """
        sys_prompt = system or self.system_prompt or ""
        start_time = time.time()

        llm_response = await self._call_with_retry(
            lambda: self.llm.create_message(
                system=sys_prompt,
                messages=[{"role": "user", "content": user_message}],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )
        )

        duration_ms = int((time.time() - start_time) * 1000)
        cost = self.llm.estimate_cost(llm_response.input_tokens, llm_response.output_tokens)

        await self._record_execution_step(
            step_type="llm_call",
            description=f"LLM Call ({llm_response.input_tokens}in/{llm_response.output_tokens}out)",
            model=self.model,
            tokens_in=llm_response.input_tokens,
            tokens_out=llm_response.output_tokens,
            cost_cents=int(cost),
            duration_ms=duration_ms,
        )

        # Emit final thought
        if llm_response.content:
            snippet = llm_response.content[:300]
            await self._append_thought(snippet)
            await self.emit("thought", {
                "text": snippet,
                "timestamp": datetime.now(UTC).isoformat(),
            })

        return llm_response.content

    @abstractmethod
    async def run(self) -> str:
        """Execute the agent workflow. Returns final output as markdown."""
        ...

    async def execute(self):
        """Top-level executor with error handling and DB updates."""
        try:
            await self._update_status("running")
            result = await self.run()
            await self._save_output(result)

            # Flush remaining thoughts
            await self._flush_thoughts()

            # Create approval if needed
            if self.briefing.autonomy_level == "needs_approval":
                await self._request_approval()
                await self._update_status("waiting_input")
                await self._update_task_status("review")
                # Notify about pending approval
                async with self.session_factory() as session:
                    await notify_approval_needed(
                        session, self.briefing.task_title, self.briefing.task_id
                    )
                    await session.commit()
            else:
                await self._update_status("completed")
                await self._update_task_status("done")
                # Notify about completion
                async with self.session_factory() as session:
                    await notify_agent_completed(
                        session, self.briefing.task_title, self.briefing.agent_name
                    )
                    await session.commit()

            await self.emit("completed", {
                "total_cost_cents": self._total_cost_cents,
                "timestamp": datetime.now(UTC).isoformat(),
            })

            # Trigger background Decision Tracks pattern analysis
            try:
                from app.services.track_service import analyze_patterns
                asyncio.create_task(
                    analyze_patterns(self.session_factory, self.instance_id)
                )
            except Exception:
                pass  # Pattern analysis is non-critical

        except asyncio.CancelledError:
            await self._flush_thoughts()
            await self._update_status("cancelled")
            await self._update_task_status("todo")
            await self.emit("cancelled", {})
        except Exception as e:
            # Flush thoughts so user can see where it crashed
            await self._flush_thoughts()
            error_msg = str(e)[:500]
            await self.emit("error", {
                "message": error_msg,
                "step": self._step_number,
                "total_cost_cents": self._total_cost_cents,
            })
            await self._update_status("failed")
            await self._update_task_status("todo")

    async def _update_status(self, status: str):
        async with self.session_factory() as session:
            result = await session.execute(
                select(AgentInstance).where(AgentInstance.id == self.instance_id)
            )
            instance = result.scalar_one_or_none()
            if instance:
                instance.status = status
                if status in ("completed", "failed", "cancelled"):
                    instance.completed_at = datetime.now(UTC)
                instance.total_cost_cents = self._total_cost_cents
                await session.commit()

    async def _update_task_status(self, status: str):
        """Update the associated task's status."""
        async with self.session_factory() as session:
            result = await session.execute(
                select(Task).where(Task.id == self.briefing.task_id)
            )
            task = result.scalar_one_or_none()
            if task:
                task.status = status
                await session.commit()

    async def _update_progress(self, percent: int, step: str, total_steps: int):
        async with self.session_factory() as session:
            result = await session.execute(
                select(AgentInstance).where(AgentInstance.id == self.instance_id)
            )
            instance = result.scalar_one_or_none()
            if instance:
                instance.progress_percent = percent
                instance.current_step = step
                instance.total_steps = total_steps
                await session.commit()

    async def _save_output(self, content: str, version: int = 1):
        async with self.session_factory() as session:
            output = TaskOutput(
                id=str(uuid4()),
                task_id=self.briefing.task_id,
                created_by_type="agent",
                created_by_id=self.instance_id,
                content_type="markdown",
                content=content,
                version=version,
            )
            session.add(output)
            await session.commit()
        await self.emit("output", {"content": content, "content_type": "markdown"})

    async def _request_approval(self):
        async with self.session_factory() as session:
            approval = Approval(
                id=str(uuid4()),
                task_id=self.briefing.task_id,
                agent_instance_id=self.instance_id,
                type="output_review",
                status="pending",
                description="Agent-Ergebnis zur Freigabe bereit",
            )
            session.add(approval)

            # Set task to review
            task_result = await session.execute(
                select(Task).where(Task.id == self.briefing.task_id)
            )
            task = task_result.scalar_one_or_none()
            if task:
                task.status = "review"

            await session.commit()
            await self.emit("approval_needed", {"approval_id": approval.id})

    async def _record_execution_step(
        self,
        step_type: str,
        description: str,
        model: str,
        tokens_in: int,
        tokens_out: int,
        cost_cents: int,
        duration_ms: int,
    ):
        self._step_number += 1
        self._total_cost_cents += cost_cents
        async with self.session_factory() as session:
            step = ExecutionStep(
                id=str(uuid4()),
                agent_instance_id=self.instance_id,
                step_number=self._step_number,
                step_type=step_type,
                description=description,
                model=model,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_cents=cost_cents,
                duration_ms=duration_ms,
                started_at=datetime.now(UTC),
            )
            session.add(step)
            await session.commit()

    # --- Thought Log Persistence ---

    async def _append_thought(self, text: str):
        """Record a thought and periodically flush to DB."""
        self._thought_entries.append({
            "text": text[:500],
            "timestamp": datetime.now(UTC).isoformat(),
        })
        self._thought_flush_count += 1
        if self._thought_flush_count >= 5:
            await self._flush_thoughts()
            self._thought_flush_count = 0

    async def _flush_thoughts(self):
        """Persist accumulated thoughts to AgentInstance.thought_log."""
        if not self._thought_entries:
            return
        async with self.session_factory() as session:
            result = await session.execute(
                select(AgentInstance).where(AgentInstance.id == self.instance_id)
            )
            instance = result.scalar_one_or_none()
            if instance:
                # Merge with existing thoughts
                existing = []
                if instance.thought_log:
                    try:
                        existing = json.loads(instance.thought_log)
                    except (json.JSONDecodeError, TypeError):
                        existing = []
                existing.extend(self._thought_entries)
                # Keep last 100 thoughts max
                instance.thought_log = json.dumps(existing[-100:])
                await session.commit()
        self._thought_entries = []

    # --- Retry Logic ---

    async def _call_with_retry(self, coro_factory, max_retries: int = 3):
        """Call an async function with exponential backoff on rate limits."""
        # Build exception tuples dynamically (Anthropic + OpenAI if installed)
        rate_limit_errors = (RateLimitError,)
        api_status_errors = (APIStatusError,)
        if OpenAIRateLimitError:
            rate_limit_errors = (RateLimitError, OpenAIRateLimitError)
        if OpenAIAPIStatusError:
            api_status_errors = (APIStatusError, OpenAIAPIStatusError)

        for attempt in range(max_retries + 1):
            try:
                return await coro_factory()
            except rate_limit_errors as e:
                if attempt == max_retries:
                    raise
                wait = 2 ** attempt * 2  # 2s, 4s, 8s
                await self.emit("retry", {
                    "attempt": attempt + 1,
                    "max_retries": max_retries,
                    "wait_seconds": wait,
                    "reason": "rate_limit",
                })
                await asyncio.sleep(wait)
            except api_status_errors as e:
                status = getattr(e, 'status_code', 0)
                if status == 529 and attempt < max_retries:
                    wait = 2 ** attempt * 3  # 3s, 6s, 12s
                    await self.emit("retry", {
                        "attempt": attempt + 1,
                        "max_retries": max_retries,
                        "wait_seconds": wait,
                        "reason": "overloaded",
                    })
                    await asyncio.sleep(wait)
                else:
                    raise

    # --- Message Handling ---

    def _check_messages(self) -> list[str]:
        """Drain and return all pending human messages."""
        msgs = list(self.messages)
        self.messages.clear()
        return msgs

    # --- Control ---

    async def _check_pause_cancel(self):
        """Check if the agent should pause or was cancelled."""
        await self._paused.wait()
        if self.cancelled:
            raise asyncio.CancelledError()

    def pause(self):
        self._paused.clear()

    def resume(self):
        self._paused.set()

    def cancel(self):
        self.cancelled = True
        self._paused.set()  # Unblock if paused

    def add_message(self, message: str):
        self.messages.append(message)

    # --- Tool-Enabled Claude Call ---

    async def _call_claude_with_tools(
        self,
        user_message: str,
        tools: list,
        system: str | None = None,
        conversation_history: list[dict] | None = None,
    ) -> str:
        """Call Claude with tool use support. Runs the agentic tool-use loop.

        Args:
            user_message: The user message to send
            tools: List of BaseTool instances
            system: System prompt (uses self.system_prompt if not provided)
            conversation_history: Optional prior messages for multi-turn

        Returns:
            The final text response from Claude
        """
        from agents.tools.base import BaseTool, ToolContext

        tool_context = ToolContext(
            session_factory=self.session_factory,
            briefing=self.briefing,
            instance_id=self.instance_id,
            sse_manager=self.sse,
        )

        # Build tool definitions
        tool_defs = [t.to_anthropic_format() for t in tools]
        tool_map = {t.name: t for t in tools}

        # Build messages
        messages = list(conversation_history or [])
        messages.append({"role": "user", "content": user_message})

        sys_prompt = system or self.system_prompt or ""
        start_time = time.time()
        total_tokens_in = 0
        total_tokens_out = 0

        # Format tool definitions via the LLM provider
        formatted_tools = self.llm.format_tools(tool_defs)

        # Agentic loop: keep calling until we get a text-only response
        max_iterations = 10
        for iteration in range(max_iterations):
            await self._check_pause_cancel()

            llm_response = await self._call_with_retry(
                lambda: self.llm.create_message(
                    system=sys_prompt,
                    messages=messages,
                    tools=formatted_tools,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                )
            )

            total_tokens_in += llm_response.input_tokens
            total_tokens_out += llm_response.output_tokens

            if not llm_response.tool_calls:
                # No tool calls — return the text
                duration_ms = int((time.time() - start_time) * 1000)

                # Record as execution step
                cost = self.llm.estimate_cost(total_tokens_in, total_tokens_out)
                await self._record_execution_step(
                    step_type="llm_call",
                    description=f"LLM + {len(tools)} Tools ({total_tokens_in}in/{total_tokens_out}out)",
                    model=self.model,
                    tokens_in=total_tokens_in,
                    tokens_out=total_tokens_out,
                    cost_cents=int(cost),
                    duration_ms=duration_ms,
                )
                return llm_response.content

            # Build assistant message with text + tool_use blocks (Anthropic format)
            assistant_content = []
            if llm_response.content:
                assistant_content.append({"type": "text", "text": llm_response.content})
            for tc in llm_response.tool_calls:
                assistant_content.append({
                    "type": "tool_use",
                    "id": tc["id"],
                    "name": tc["name"],
                    "input": tc["input"],
                })
            messages.append({"role": "assistant", "content": assistant_content})

            tool_results = []
            for tool_call in llm_response.tool_calls:
                tool = tool_map.get(tool_call["name"])
                if not tool:
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_call["id"],
                        "content": f"Fehler: Tool '{tool_call['name']}' nicht gefunden.",
                        "is_error": True,
                    })
                    continue

                # Emit SSE event for tool call
                await self.emit("tool_call", {
                    "tool_name": tool_call["name"],
                    "parameters": tool_call["input"],
                    "iteration": iteration + 1,
                })

                # Execute tool
                tool_start = time.time()
                try:
                    result = await tool.execute(tool_call["input"], tool_context)
                except Exception as e:
                    result = f"Fehler bei Tool-Ausführung: {str(e)}"

                tool_duration = int((time.time() - tool_start) * 1000)

                # Record tool call as execution step
                await self._record_execution_step(
                    step_type="tool_call",
                    description=f"Tool: {tool_call['name']}",
                    model="",
                    tokens_in=0,
                    tokens_out=0,
                    cost_cents=0,
                    duration_ms=tool_duration,
                )

                # Record Decision Track point (non-critical, fire-and-forget)
                try:
                    from app.services.track_service import record_track_point
                    self._track_sequence_index += 1
                    await record_track_point(
                        session_factory=self.session_factory,
                        agent_instance_id=self.instance_id,
                        task_id=self.briefing.task_id,
                        project_id=self.briefing.project_id or None,
                        tool_name=tool_call["name"],
                        parameters=tool_call["input"],
                        result=result,
                        duration_ms=tool_duration,
                        sequence_index=self._track_sequence_index,
                    )
                except Exception:
                    pass  # Track recording must never block agent execution

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_call["id"],
                    "content": result[:10000],  # Limit tool result size
                })

                # Emit thought about tool result
                summary = result[:200] if len(result) > 200 else result
                await self._append_thought(f"[Tool: {tool_call['name']}] {summary}")
                await self.emit("thought", {
                    "text": f"[{tool_call['name']}] {summary}",
                    "timestamp": datetime.now(UTC).isoformat(),
                })

            # Add tool results as user message
            messages.append({"role": "user", "content": tool_results})

        # If we hit max iterations, return whatever text we have
        return "Maximale Tool-Iterationen erreicht."

    # --- Multi-Turn Revision ---

    async def revise(self, feedback: str) -> str:
        """Revise the previous output based on feedback.

        Loads previous output from DB, asks Claude to revise,
        saves new version, and re-enters approval flow if needed.
        """
        await self._update_status("running")
        await self.emit("revision_start", {
            "feedback": feedback[:200],
            "timestamp": datetime.now(UTC).isoformat(),
        })

        # Load previous output
        previous_output = ""
        async with self.session_factory() as session:
            result = await session.execute(
                select(TaskOutput)
                .where(TaskOutput.task_id == self.briefing.task_id)
                .order_by(TaskOutput.version.desc())
            )
            output = result.scalar_one_or_none()
            if output:
                previous_output = output.content
                next_version = output.version + 1
            else:
                next_version = 1

        # Build revision prompt
        revision_prompt = (
            f"Du hast folgenden Bericht erstellt:\n\n{previous_output[:3000]}\n\n"
            f"Der Reviewer hat folgendes Feedback gegeben:\n{feedback}\n\n"
            f"Bitte überarbeite den Bericht basierend auf dem Feedback. "
            f"Behalte die Struktur bei und verbessere die genannten Punkte."
        )

        sys_prompt = self.system_prompt or ""
        start_time = time.time()

        llm_response = await self._call_with_retry(
            lambda: self.llm.create_message(
                system=sys_prompt,
                messages=[{"role": "user", "content": revision_prompt}],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )
        )

        duration_ms = int((time.time() - start_time) * 1000)
        revised = llm_response.content

        tokens_in = llm_response.input_tokens
        tokens_out = llm_response.output_tokens
        cost = self.llm.estimate_cost(tokens_in, tokens_out)

        await self._record_execution_step(
            step_type="revision",
            description=f"Revision nach Feedback ({tokens_in}in/{tokens_out}out)",
            model=self.model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_cents=int(cost),
            duration_ms=duration_ms,
        )

        # Save revised output
        await self._save_output(revised, version=next_version)

        # Re-enter approval flow if needed
        if self.briefing.autonomy_level == "needs_approval":
            await self._request_approval()
            await self._update_status("waiting_input")
        else:
            await self._update_status("completed")

        return revised

    def _estimate_cost(self, tokens_in: int, tokens_out: int) -> int:
        """Estimate cost in cents using the LLM provider's pricing."""
        if hasattr(self, 'llm') and self.llm:
            return int(self.llm.estimate_cost(tokens_in, tokens_out))
        # Fallback: Claude Sonnet pricing ($3/1M input, $15/1M output)
        return int(
            (tokens_in / 1_000_000 * 300)
            + (tokens_out / 1_000_000 * 1500)
        )
