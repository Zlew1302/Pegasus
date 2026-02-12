"""Pydantic schemas for Decision Tracks API."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TrackPointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_instance_id: str
    task_id: str
    project_id: Optional[str] = None
    system_type: str
    action_type: str
    tool_name: str
    entities: list[dict] = []
    input_summary: Optional[str] = None
    output_summary: Optional[str] = None
    signal_score: Optional[float] = None
    sequence_index: int
    duration_ms: Optional[int] = None
    created_at: Optional[str] = None


class EntityNodeResponse(BaseModel):
    id: str
    type: str
    name: str
    occurrences: int
    last_seen: Optional[str] = None


class EntityRelationshipResponse(BaseModel):
    source: dict
    target: dict
    type: str
    weight: float
    observations: int


class OrgInsightsSummary(BaseModel):
    total_entities: int
    total_relationships: int
    total_track_points: int


class OrgInsightsResponse(BaseModel):
    summary: OrgInsightsSummary
    top_entities: list[EntityNodeResponse]
    top_relationships: list[EntityRelationshipResponse]


class WorkflowPatternResponse(BaseModel):
    id: str
    label: str
    sequence: list[dict]
    frequency: int
    confidence: float
    avg_signal: float
    last_observed: Optional[str] = None


class EntityGraphNode(BaseModel):
    id: str
    type: str
    name: str
    occurrences: int


class EntityGraphEdge(BaseModel):
    source: str
    target: str
    type: str
    weight: float


class EntityGraphResponse(BaseModel):
    nodes: list[EntityGraphNode]
    edges: list[EntityGraphEdge]


class InstanceTracksResponse(BaseModel):
    instance_id: str
    track_points: list[dict]
    total_points: int
