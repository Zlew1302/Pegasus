"""Decision Tracks models — organizational learning from agent tool execution.

Schema.org-typed entities, co-occurrence relationships, and learned workflow patterns.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class TrackPoint(Base):
    """Every observation an agent makes during tool execution.

    Records system, action, entities found, usefulness signal,
    and links back to the ExecutionStep + AgentInstance.
    """

    __tablename__ = "track_points"
    __table_args__ = (
        Index("ix_track_points_instance_id", "agent_instance_id"),
        Index("ix_track_points_system", "system_type"),
        Index("ix_track_points_created", "created_at"),
        Index("ix_track_points_task_id", "task_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    agent_instance_id: Mapped[str] = mapped_column(
        ForeignKey("agent_instances.id"), nullable=False
    )
    execution_step_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("execution_steps.id"), nullable=True
    )
    task_id: Mapped[str] = mapped_column(
        ForeignKey("tasks.id"), nullable=False
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("projects.id"), nullable=True
    )

    # What system was accessed (Schema.org SoftwareApplication)
    system_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # e.g.: "github", "email", "slack", "drive", "web", "internal_db",
    #        "knowledge_base", "jira", "confluence", "spreadsheet"

    # What action was performed (Schema.org Action subtypes)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # e.g.: "SearchAction", "ReadAction", "WriteAction", "CommunicateAction",
    #        "CreateAction", "UpdateAction", "DeleteAction", "AssessAction"

    # Tool that was used
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # What entities were found/touched (JSON array of entity references)
    entities_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Format: [{"type": "Person", "name": "...", "source": "email"}, ...]

    # Raw input summary (what was asked)
    input_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Raw output summary (what was found, max 500 chars)
    output_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Was this useful for the task outcome? (1.0 = highly useful, 0.0 = noise)
    signal_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Sequence position within the agent run
    sequence_index: Mapped[int] = mapped_column(Integer, default=0)

    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class EntityNode(Base):
    """A Schema.org-typed entity discovered across agent runs.

    Entities are deduplicated by (schema_type, canonical_name).
    Accumulated over time as agents discover the real org structure.
    """

    __tablename__ = "entity_nodes"
    __table_args__ = (
        Index("ix_entity_nodes_type", "schema_type"),
        Index("ix_entity_nodes_canonical", "canonical_name"),
        Index(
            "ix_entity_nodes_type_name",
            "schema_type",
            "canonical_name",
            unique=True,
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Schema.org type
    schema_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # e.g.: "Person", "Organization", "SoftwareApplication", "Project",
    #        "DigitalDocument", "Dataset", "CreativeWork", "CommunicationChannel"

    # Deduplicated name (lowercase)
    canonical_name: Mapped[str] = mapped_column(String(500), nullable=False)

    # Additional properties (JSON)
    properties_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # e.g.: {"email": "...", "url": "...", "department": "..."}

    # How many times this entity has been seen across all tracks
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1)

    # Last time this entity was referenced
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class EntityRelationship(Base):
    """Weighted edge between two EntityNodes.

    Tracks co-occurrence of entities. Over many tasks, reveals the
    real working relationships vs. org-chart relationships.
    Edge weight decays over time (freshness).
    """

    __tablename__ = "entity_relationships"
    __table_args__ = (
        Index("ix_entity_rel_source", "source_entity_id"),
        Index("ix_entity_rel_target", "target_entity_id"),
        Index(
            "ix_entity_rel_pair",
            "source_entity_id",
            "target_entity_id",
            unique=True,
        ),
        Index("ix_entity_rel_type", "relationship_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_entity_id: Mapped[str] = mapped_column(
        ForeignKey("entity_nodes.id", ondelete="CASCADE"), nullable=False
    )
    target_entity_id: Mapped[str] = mapped_column(
        ForeignKey("entity_nodes.id", ondelete="CASCADE"), nullable=False
    )

    # Schema.org relationship type
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # e.g.: "worksFor", "memberOf", "knows", "isPartOf", "hasPart",
    #        "collaboratesWith", "uses", "createdBy", "relatedTo"

    # Co-occurrence weight (incremented each time both entities appear together)
    raw_weight: Mapped[float] = mapped_column(Float, default=1.0)

    # Time-decayed weight (recalculated by analyze_patterns)
    decayed_weight: Mapped[float] = mapped_column(Float, default=1.0)

    # Context: in what type of tasks does this relationship appear?
    context_tags_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # e.g.: ["marketing", "budget", "engineering"]

    # How many distinct agent runs contributed to this edge
    observation_count: Mapped[int] = mapped_column(Integer, default=1)

    last_observed_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    source_entity: Mapped["EntityNode"] = relationship(
        foreign_keys=[source_entity_id]
    )
    target_entity: Mapped["EntityNode"] = relationship(
        foreign_keys=[target_entity_id]
    )


class WorkflowPattern(Base):
    """A learned frequent sequence of TrackPoints.

    Discovered by sequence mining across completed agent runs.
    Used for proactive workflow suggestions on new tasks.
    """

    __tablename__ = "workflow_patterns"
    __table_args__ = (
        Index("ix_workflow_patterns_frequency", "frequency"),
        Index("ix_workflow_patterns_category", "category"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Human-readable label (generated algorithmically)
    label: Mapped[str] = mapped_column(String(500), nullable=False)

    # The sequence of (system_type, action_type) pairs as JSON
    sequence_json: Mapped[str] = mapped_column(Text, nullable=False)
    # Format: [{"system": "jira", "action": "SearchAction"},
    #           {"system": "slack", "action": "ReadAction"}, ...]

    # How many distinct agent runs contained this subsequence
    frequency: Mapped[int] = mapped_column(Integer, default=1)

    # Task category / tags where this pattern appears most
    category: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )

    # Average signal score across instances of this pattern
    avg_signal_score: Mapped[float] = mapped_column(Float, default=0.5)

    # Confidence: frequency * avg_signal_score (precomputed)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    # Entity names commonly associated with this pattern (JSON array)
    associated_entities_json: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )

    # Example task IDs where this pattern was observed
    example_task_ids_json: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )

    last_observed_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
