"""Decision Tracks service — records, analyzes, and queries organizational learning.

Three main entry points:
1. record_track_point()  — hot path, called during tool execution (<5ms target)
2. analyze_patterns()    — cold path, background job after agent completion
3. get_workflow_suggestions() — query path, called when agent starts new task (<200ms target)
"""

import json
import logging
import math
import re
import time
from datetime import datetime, UTC
from itertools import combinations
from typing import Optional
from uuid import uuid4

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.tracks import (
    TrackPoint,
    EntityNode,
    EntityRelationship,
    WorkflowPattern,
)

logger = logging.getLogger(__name__)


# ── Entity Extraction Patterns (precompiled for performance) ──────────

_EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_URL_PATTERN = re.compile(r"https?://(?:[\w.-]+)(?:/[\w./?%&=\-#]*)?")
_GITHUB_REPO_PATTERN = re.compile(
    r"(?:github\.com/|^)([\w-]+/[\w.-]+)", re.MULTILINE
)
_SLACK_CHANNEL_PATTERN = re.compile(r"#([\w-]{2,})")
_PERSON_MENTION_PATTERN = re.compile(r"@([\w.-]+)")
_DOCUMENT_PATTERN = re.compile(
    r"(?:^|\s)([\w-]+\.(?:pdf|docx?|xlsx?|csv|md|txt|pptx?))\b",
    re.IGNORECASE,
)

# ── System / Action Classification ────────────────────────────────────

TOOL_TO_SYSTEM: dict[str, str] = {
    "web_search": "web",
    "read_project_context": "internal_db",
    "task_management": "internal_db",
    "delegate_to_agent": "internal_db",
    "knowledge_search": "knowledge_base",
}

ACTION_TYPE_MAP: dict[str, str] = {
    "search": "SearchAction",
    "read": "ReadAction",
    "write": "WriteAction",
    "create": "CreateAction",
    "update": "UpdateAction",
    "delete": "DeleteAction",
    "navigate": "ReadAction",
    "list": "SearchAction",
    "get": "ReadAction",
    "post": "CreateAction",
    "patch": "UpdateAction",
    "send": "CommunicateAction",
}

# Decay constant: half-life of 60 days
DECAY_HALF_LIFE_DAYS = 60
DECAY_LAMBDA = 0.693 / DECAY_HALF_LIFE_DAYS


# ── Classification Functions ──────────────────────────────────────────


def classify_system(tool_name: str, parameters: dict) -> str:
    """Classify what system a tool call touches."""
    if tool_name in TOOL_TO_SYSTEM:
        return TOOL_TO_SYSTEM[tool_name]

    # Infer from parameters
    param_str = json.dumps(parameters).lower()
    if "github" in param_str:
        return "github"
    if "slack" in param_str or "channel" in param_str:
        return "slack"
    if "email" in param_str or "mail" in param_str:
        return "email"
    if "drive" in param_str or "docs.google" in param_str:
        return "drive"
    if "jira" in param_str or "ticket" in param_str:
        return "jira"
    if "confluence" in param_str or "wiki" in param_str:
        return "confluence"

    return "unknown"


def classify_action(tool_name: str, parameters: dict) -> str:
    """Classify the Schema.org Action type."""
    for keyword, action in ACTION_TYPE_MAP.items():
        if keyword in tool_name.lower():
            return action

    if "query" in parameters or "search" in parameters:
        return "SearchAction"
    if "create" in parameters or "add" in parameters:
        return "CreateAction"

    return "SearchAction"  # Default


def extract_entities(
    tool_name: str,
    parameters: dict,
    result: str,
) -> list[dict]:
    """Extract Schema.org typed entities from tool parameters and results.

    Pure regex + heuristic. No LLM calls.
    Target: <2ms execution time.
    """
    entities: list[dict] = []
    combined = json.dumps(parameters, ensure_ascii=False) + " " + (
        result[:2000] if result else ""
    )
    seen_names: set[str] = set()

    def _add(schema_type: str, name: str, source: str = "content"):
        name_lower = name.strip().lower()
        if name_lower and name_lower not in seen_names and len(name_lower) > 1:
            seen_names.add(name_lower)
            entities.append(
                {"type": schema_type, "name": name.strip(), "source": source}
            )

    # Emails -> Person
    for match in _EMAIL_PATTERN.finditer(combined):
        email = match.group(0)
        name = email.split("@")[0].replace(".", " ").replace("-", " ").title()
        _add("Person", name, "email")

    # @mentions -> Person
    for match in _PERSON_MENTION_PATTERN.finditer(combined):
        _add("Person", match.group(1), "mention")

    # GitHub repos -> SoftwareSourceCode
    for match in _GITHUB_REPO_PATTERN.finditer(combined):
        _add("SoftwareSourceCode", match.group(1), "github")

    # Slack channels -> CommunicationChannel
    for match in _SLACK_CHANNEL_PATTERN.finditer(combined):
        _add("CommunicationChannel", match.group(1), "slack")

    # URLs -> SoftwareApplication (domain)
    for match in _URL_PATTERN.finditer(combined):
        url = match.group(0)
        try:
            from urllib.parse import urlparse

            domain = urlparse(url).netloc
            if domain and domain not in seen_names:
                _add("SoftwareApplication", domain, "url")
        except Exception:
            pass

    # Documents -> DigitalDocument
    for match in _DOCUMENT_PATTERN.finditer(combined):
        _add("DigitalDocument", match.group(1), "filename")

    return entities[:20]  # Cap at 20 entities per track point


# ── Hot Path: Record Track Point (<5ms target) ───────────────────────


async def record_track_point(
    session_factory: async_sessionmaker[AsyncSession],
    agent_instance_id: str,
    task_id: str,
    project_id: str | None,
    tool_name: str,
    parameters: dict,
    result: str,
    duration_ms: int,
    sequence_index: int,
    execution_step_id: str | None = None,
) -> str:
    """Record a single track point from a tool execution.

    PERFORMANCE TARGET: <5ms overhead. Does NOT do entity resolution
    or pattern analysis. Those happen in analyze_patterns().

    Returns: track_point_id
    """
    start = time.monotonic()

    system_type = classify_system(tool_name, parameters)
    action_type = classify_action(tool_name, parameters)
    entities = extract_entities(tool_name, parameters, result)

    input_summary = json.dumps(parameters, ensure_ascii=False)[:200]
    output_summary = result[:500] if result else None

    tp_id = str(uuid4())

    async with session_factory() as session:
        tp = TrackPoint(
            id=tp_id,
            agent_instance_id=agent_instance_id,
            execution_step_id=execution_step_id,
            task_id=task_id,
            project_id=project_id,
            system_type=system_type,
            action_type=action_type,
            tool_name=tool_name,
            entities_json=(
                json.dumps(entities, ensure_ascii=False) if entities else None
            ),
            input_summary=input_summary,
            output_summary=output_summary,
            sequence_index=sequence_index,
            duration_ms=duration_ms,
        )
        session.add(tp)
        await session.commit()

    elapsed = (time.monotonic() - start) * 1000
    if elapsed > 10:
        logger.warning(
            f"TrackPoint recording took {elapsed:.1f}ms (target <5ms)"
        )

    return tp_id


# ── Background Job: Pattern Analysis ─────────────────────────────────


async def analyze_patterns(
    session_factory: async_sessionmaker[AsyncSession],
    agent_instance_id: str,
) -> None:
    """Post-completion analysis: entity resolution, relationship scoring, pattern mining.

    Called as fire-and-forget after agent.execute() completes.
    Can take 100-500ms. Not in hot path.
    """
    start = time.monotonic()

    async with session_factory() as session:
        # 1. Load all track points for this run
        result = await session.execute(
            select(TrackPoint)
            .where(TrackPoint.agent_instance_id == agent_instance_id)
            .order_by(TrackPoint.sequence_index)
        )
        track_points = list(result.scalars().all())

        if not track_points:
            return

        # 2. Signal scoring
        _compute_signal_scores(track_points)

        # 3. Entity resolution
        entity_id_map = await _resolve_entities(session, track_points)

        # 4. Co-occurrence relationships
        await _update_relationships(session, track_points, entity_id_map)

        # 5. Sequence mining
        await _mine_sequences(session, track_points)

        # 6. Decay existing relationship weights
        await _apply_decay(session)

        await session.commit()

    elapsed = (time.monotonic() - start) * 1000
    logger.info(
        f"Decision Tracks: pattern analysis for {agent_instance_id}: "
        f"{len(track_points)} points, {elapsed:.0f}ms"
    )


def _compute_signal_scores(track_points: list[TrackPoint]) -> None:
    """Heuristic signal scoring. Higher = more useful for task outcome."""
    total = len(track_points)

    # Collect all entity names across all points
    all_entity_names: dict[int, set[str]] = {}
    for i, tp in enumerate(track_points):
        names: set[str] = set()
        if tp.entities_json:
            try:
                entities = json.loads(tp.entities_json)
                names = {
                    e["name"].lower() for e in entities if "name" in e
                }
            except (json.JSONDecodeError, TypeError):
                pass
        all_entity_names[i] = names

    for i, tp in enumerate(track_points):
        score = 0.5  # Baseline

        # Non-empty result bonus
        if tp.output_summary and len(tp.output_summary) > 50:
            score += 0.1

        # Middle-of-sequence bonus (bell curve)
        if total > 2:
            position_ratio = i / (total - 1)
            position_bonus = 0.15 * math.exp(
                -8 * (position_ratio - 0.5) ** 2
            )
            score += position_bonus

        # Entity reuse bonus
        my_entities = all_entity_names.get(i, set())
        if my_entities:
            reuse_count = 0
            for j in range(i + 1, total):
                later_entities = all_entity_names.get(j, set())
                reuse_count += len(my_entities & later_entities)
            if reuse_count > 0:
                score += min(0.2, 0.05 * reuse_count)

        tp.signal_score = min(1.0, max(0.0, score))


async def _resolve_entities(
    session: AsyncSession,
    track_points: list[TrackPoint],
) -> dict[str, str]:
    """Upsert discovered entities into the EntityNode table.

    Returns: mapping of "type:canonical_name" -> entity_node_id
    """
    entity_map: dict[str, str] = {}
    now = datetime.now(UTC)

    for tp in track_points:
        if not tp.entities_json:
            continue
        try:
            entities = json.loads(tp.entities_json)
        except (json.JSONDecodeError, TypeError):
            continue

        for entity in entities:
            schema_type = entity.get("type", "Thing")
            name = entity.get("name", "").strip()
            if not name:
                continue

            canonical = name.lower()
            key = f"{schema_type}:{canonical}"

            if key in entity_map:
                continue  # Already resolved in this batch

            # Try to find existing
            result = await session.execute(
                select(EntityNode).where(
                    EntityNode.schema_type == schema_type,
                    EntityNode.canonical_name == canonical,
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.occurrence_count += 1
                existing.last_seen_at = now
                entity_map[key] = existing.id
            else:
                node_id = str(uuid4())
                props = {
                    k: v
                    for k, v in entity.items()
                    if k not in ("type", "name")
                }
                node = EntityNode(
                    id=node_id,
                    schema_type=schema_type,
                    canonical_name=canonical,
                    properties_json=(
                        json.dumps(props, ensure_ascii=False)
                        if props
                        else None
                    ),
                    occurrence_count=1,
                    first_seen_at=now,
                    last_seen_at=now,
                )
                session.add(node)
                entity_map[key] = node_id

    return entity_map


async def _update_relationships(
    session: AsyncSession,
    track_points: list[TrackPoint],
    entity_map: dict[str, str],
) -> None:
    """Update co-occurrence edges between entities.

    For each TrackPoint, all entities that appear together
    get their pairwise relationship weight incremented.
    """
    now = datetime.now(UTC)

    for tp in track_points:
        if not tp.entities_json:
            continue
        try:
            entities = json.loads(tp.entities_json)
        except (json.JSONDecodeError, TypeError):
            continue

        # Get entity IDs for this track point
        entity_ids: list[str] = []
        for entity in entities:
            key = f"{entity.get('type', 'Thing')}:{entity.get('name', '').strip().lower()}"
            if key in entity_map:
                entity_ids.append(entity_map[key])

        # Create/update pairwise edges
        for source_id, target_id in combinations(sorted(set(entity_ids)), 2):
            result = await session.execute(
                select(EntityRelationship).where(
                    EntityRelationship.source_entity_id == source_id,
                    EntityRelationship.target_entity_id == target_id,
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.raw_weight += 1.0
                existing.decayed_weight = existing.raw_weight
                existing.observation_count += 1
                existing.last_observed_at = now
            else:
                rel = EntityRelationship(
                    id=str(uuid4()),
                    source_entity_id=source_id,
                    target_entity_id=target_id,
                    relationship_type="relatedTo",
                    raw_weight=1.0,
                    decayed_weight=1.0,
                    observation_count=1,
                    last_observed_at=now,
                )
                session.add(rel)


async def _mine_sequences(
    session: AsyncSession,
    track_points: list[TrackPoint],
) -> None:
    """Extract frequent (system, action) subsequences and upsert into WorkflowPattern.

    Uses contiguous n-gram extraction (n=2..5).
    """
    if len(track_points) < 2:
        return

    sequence = [
        {"system": tp.system_type, "action": tp.action_type}
        for tp in track_points
    ]

    task_id = track_points[0].task_id if track_points else None
    max_n = min(5, len(sequence))

    for n in range(2, max_n + 1):
        for start in range(len(sequence) - n + 1):
            subseq = sequence[start : start + n]
            subseq_json = json.dumps(subseq, sort_keys=True)

            result = await session.execute(
                select(WorkflowPattern).where(
                    WorkflowPattern.sequence_json == subseq_json
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.frequency += 1
                existing.last_observed_at = datetime.now(UTC)
                # Update example tasks
                try:
                    examples = json.loads(
                        existing.example_task_ids_json or "[]"
                    )
                except (json.JSONDecodeError, TypeError):
                    examples = []
                if task_id and task_id not in examples:
                    examples.append(task_id)
                    existing.example_task_ids_json = json.dumps(
                        examples[-10:]
                    )
                existing.confidence = (
                    existing.frequency * existing.avg_signal_score
                )
            else:
                signal_scores = [
                    track_points[start + i].signal_score or 0.5
                    for i in range(n)
                ]
                avg_signal = sum(signal_scores) / len(signal_scores)

                steps = [f"{s['system']}:{s['action']}" for s in subseq]
                label = " → ".join(steps)

                pattern = WorkflowPattern(
                    id=str(uuid4()),
                    label=label,
                    sequence_json=subseq_json,
                    frequency=1,
                    avg_signal_score=avg_signal,
                    confidence=avg_signal,
                    example_task_ids_json=(
                        json.dumps([task_id]) if task_id else None
                    ),
                )
                session.add(pattern)


async def _apply_decay(session: AsyncSession) -> None:
    """Apply time-decay to all relationship weights.

    Formula: decayed_weight = raw_weight * exp(-lambda * days_since_last_observed)
    """
    now = datetime.now(UTC)

    result = await session.execute(select(EntityRelationship))
    relationships = result.scalars().all()

    for rel in relationships:
        if rel.last_observed_at:
            days_old = max(
                (now - rel.last_observed_at).total_seconds() / 86400, 0
            )
        else:
            days_old = 0
        rel.decayed_weight = rel.raw_weight * math.exp(
            -DECAY_LAMBDA * days_old
        )


# ── Query Functions ───────────────────────────────────────────────────


async def get_workflow_suggestions(
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    task_title: str = "",
    task_description: str = "",
    project_id: str | None = None,
    limit: int = 5,
    *,
    session: AsyncSession | None = None,
) -> list[dict]:
    """Query learned patterns for a new task. Returns workflow suggestions.

    Accepts either session_factory (for calls from agent_service) or
    a pre-existing session (for calls from the router via Depends).

    PERFORMANCE TARGET: <200ms.
    """

    async def _query(s: AsyncSession) -> list[dict]:
        stmt = (
            select(WorkflowPattern)
            .where(WorkflowPattern.frequency >= 2)
            .order_by(desc(WorkflowPattern.confidence))
            .limit(limit)
        )

        result = await s.execute(stmt)
        patterns = result.scalars().all()

        suggestions = []
        for pattern in patterns:
            try:
                sequence = json.loads(pattern.sequence_json)
            except (json.JSONDecodeError, TypeError):
                continue

            suggestions.append(
                {
                    "id": pattern.id,
                    "label": pattern.label,
                    "sequence": sequence,
                    "frequency": pattern.frequency,
                    "confidence": round(pattern.confidence, 2),
                    "avg_signal": round(pattern.avg_signal_score, 2),
                    "last_observed": (
                        pattern.last_observed_at.isoformat()
                        if pattern.last_observed_at
                        else None
                    ),
                }
            )

        return suggestions

    if session is not None:
        return await _query(session)
    assert session_factory is not None, "Either session or session_factory required"
    async with session_factory() as s:
        return await _query(s)


async def get_org_insights(
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    limit: int = 50,
    *,
    session: AsyncSession | None = None,
) -> dict:
    """Return organizational structure insights from accumulated tracks."""

    async def _query(s: AsyncSession) -> dict:
        # Top entities
        entities_result = await s.execute(
            select(EntityNode)
            .order_by(desc(EntityNode.occurrence_count))
            .limit(limit)
        )
        top_entities = [
            {
                "id": e.id,
                "type": e.schema_type,
                "name": e.canonical_name,
                "occurrences": e.occurrence_count,
                "last_seen": (
                    e.last_seen_at.isoformat() if e.last_seen_at else None
                ),
            }
            for e in entities_result.scalars().all()
        ]

        # Strongest relationships
        rels_result = await s.execute(
            select(EntityRelationship)
            .order_by(desc(EntityRelationship.decayed_weight))
            .limit(limit)
        )
        relationships = rels_result.scalars().all()

        # Load entity names for relationships
        entity_ids = set()
        for r in relationships:
            entity_ids.add(r.source_entity_id)
            entity_ids.add(r.target_entity_id)

        entity_names: dict[str, dict] = {}
        if entity_ids:
            names_result = await s.execute(
                select(EntityNode).where(EntityNode.id.in_(entity_ids))
            )
            for e in names_result.scalars().all():
                entity_names[e.id] = {
                    "name": e.canonical_name,
                    "type": e.schema_type,
                }

        top_relationships = [
            {
                "source": entity_names.get(
                    r.source_entity_id, {"name": "?", "type": "Thing"}
                ),
                "target": entity_names.get(
                    r.target_entity_id, {"name": "?", "type": "Thing"}
                ),
                "type": r.relationship_type,
                "weight": round(r.decayed_weight, 2),
                "observations": r.observation_count,
            }
            for r in relationships
        ]

        # Summary stats
        total_entities = (
            await s.scalar(
                select(func.count()).select_from(EntityNode)
            )
            or 0
        )
        total_relationships = (
            await s.scalar(
                select(func.count()).select_from(EntityRelationship)
            )
            or 0
        )
        total_track_points = (
            await s.scalar(
                select(func.count()).select_from(TrackPoint)
            )
            or 0
        )

        return {
            "summary": {
                "total_entities": total_entities,
                "total_relationships": total_relationships,
                "total_track_points": total_track_points,
            },
            "top_entities": top_entities,
            "top_relationships": top_relationships,
        }

    if session is not None:
        return await _query(session)
    assert session_factory is not None, "Either session or session_factory required"
    async with session_factory() as s:
        return await _query(s)


async def get_entity_graph(
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    limit: int = 100,
    schema_type: str | None = None,
    *,
    session: AsyncSession | None = None,
) -> dict:
    """Entity relationship graph data for visualization."""

    async def _query(s: AsyncSession) -> dict:
        entity_stmt = (
            select(EntityNode)
            .order_by(desc(EntityNode.occurrence_count))
            .limit(limit)
        )
        if schema_type:
            entity_stmt = entity_stmt.where(
                EntityNode.schema_type == schema_type
            )

        entities_result = await s.execute(entity_stmt)
        entities = entities_result.scalars().all()
        entity_ids = {e.id for e in entities}

        nodes = [
            {
                "id": e.id,
                "type": e.schema_type,
                "name": e.canonical_name,
                "occurrences": e.occurrence_count,
            }
            for e in entities
        ]

        edges: list[dict] = []
        if entity_ids:
            rels_result = await s.execute(
                select(EntityRelationship)
                .where(
                    EntityRelationship.source_entity_id.in_(entity_ids),
                    EntityRelationship.target_entity_id.in_(entity_ids),
                )
                .order_by(desc(EntityRelationship.decayed_weight))
                .limit(limit * 2)
            )
            edges = [
                {
                    "source": r.source_entity_id,
                    "target": r.target_entity_id,
                    "type": r.relationship_type,
                    "weight": round(r.decayed_weight, 2),
                }
                for r in rels_result.scalars().all()
            ]

        return {"nodes": nodes, "edges": edges}

    if session is not None:
        return await _query(session)
    assert session_factory is not None, "Either session or session_factory required"
    async with session_factory() as s:
        return await _query(s)


async def get_instance_tracks(
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    instance_id: str = "",
    *,
    session: AsyncSession | None = None,
) -> list[dict]:
    """Get all track points for a specific agent run, ordered by sequence."""

    async def _query(s: AsyncSession) -> list[dict]:
        result = await s.execute(
            select(TrackPoint)
            .where(TrackPoint.agent_instance_id == instance_id)
            .order_by(TrackPoint.sequence_index)
        )
        points = result.scalars().all()

        return [
            {
                "id": tp.id,
                "system_type": tp.system_type,
                "action_type": tp.action_type,
                "tool_name": tp.tool_name,
                "entities": (
                    json.loads(tp.entities_json)
                    if tp.entities_json
                    else []
                ),
                "input_summary": tp.input_summary,
                "output_summary": tp.output_summary,
                "signal_score": tp.signal_score,
                "sequence_index": tp.sequence_index,
                "duration_ms": tp.duration_ms,
                "created_at": (
                    tp.created_at.isoformat() if tp.created_at else None
                ),
            }
            for tp in points
        ]

    if session is not None:
        return await _query(session)
    assert session_factory is not None, "Either session or session_factory required"
    async with session_factory() as s:
        return await _query(s)
