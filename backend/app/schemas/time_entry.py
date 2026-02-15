from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TimeEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    user_id: str
    started_at: datetime
    ended_at: datetime | None = None
    duration_minutes: int = 0
    note: str | None = None
    is_running: bool = False
    created_at: datetime


class TimeEntryCreate(BaseModel):
    duration_minutes: int
    note: str | None = None


class TimeSummaryEntry(BaseModel):
    task_id: str
    task_title: str
    total_minutes: int
    entry_count: int
