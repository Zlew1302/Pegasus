from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TeamMemberAdd(BaseModel):
    member_type: str  # "human" or "agent"
    member_id: str
    role: str = "member"


class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    member_count: int = 0


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    team_id: str
    member_type: str
    member_id: str
    role: str
    joined_at: datetime
