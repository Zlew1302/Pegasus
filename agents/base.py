"""Base agent class for all CrewBoard agents."""

import asyncio
from abc import ABC, abstractmethod
from datetime import datetime
from uuid import uuid4

from anthropic import AsyncAnthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from agents.briefing import TaskBriefing
from app.models.agent import AgentInstance
from app.models.approval import Approval
from app.models.execution import ExecutionStep
from app.models.output import TaskOutput
from app.models.task import Task
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
        self.client = AsyncAnthropic()
        self.cancelled = False
        self._paused = asyncio.Event()
        self._paused.set()  # Not paused by default
        self.messages: list[str] = []  # Human messages queue
        self._step_number = 0
        self._total_cost_cents = 0

    async def emit(self, event_type: str, data: dict):
        await self.sse.emit(self.instance_id, SSEEvent(event=event_type, data=data))

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

            # Create approval if needed
            if self.briefing.autonomy_level == "needs_approval":
                await self._request_approval()
                await self._update_status("waiting_input")
            else:
                await self._update_status("completed")

            await self.emit("completed", {
                "total_cost_cents": self._total_cost_cents,
                "timestamp": datetime.utcnow().isoformat(),
            })
        except asyncio.CancelledError:
            await self._update_status("cancelled")
            await self.emit("cancelled", {})
        except Exception as e:
            await self.emit("error", {"message": str(e)})
            await self._update_status("failed")

    async def _update_status(self, status: str):
        async with self.session_factory() as session:
            result = await session.execute(
                select(AgentInstance).where(AgentInstance.id == self.instance_id)
            )
            instance = result.scalar_one_or_none()
            if instance:
                instance.status = status
                if status in ("completed", "failed", "cancelled"):
                    instance.completed_at = datetime.utcnow()
                instance.total_cost_cents = self._total_cost_cents
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

    async def _save_output(self, content: str):
        async with self.session_factory() as session:
            output = TaskOutput(
                id=str(uuid4()),
                task_id=self.briefing.task_id,
                created_by_type="agent",
                created_by_id=self.instance_id,
                content_type="markdown",
                content=content,
                version=1,
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
                started_at=datetime.utcnow(),
            )
            session.add(step)
            await session.commit()

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
