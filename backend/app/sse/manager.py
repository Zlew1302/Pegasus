import asyncio
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SSEEvent:
    event: str
    data: dict[str, Any]


class SSEManager:
    def __init__(self):
        self._channels: dict[str, list[asyncio.Queue]] = {}

    def subscribe(self, instance_id: str) -> asyncio.Queue:
        if instance_id not in self._channels:
            self._channels[instance_id] = []
        queue: asyncio.Queue = asyncio.Queue()
        self._channels[instance_id].append(queue)
        return queue

    def unsubscribe(self, instance_id: str, queue: asyncio.Queue):
        if instance_id in self._channels:
            try:
                self._channels[instance_id].remove(queue)
            except ValueError:
                pass
            if not self._channels[instance_id]:
                del self._channels[instance_id]

    async def emit(self, instance_id: str, event: SSEEvent):
        if instance_id in self._channels:
            for queue in self._channels[instance_id]:
                await queue.put(event)


sse_manager = SSEManager()
