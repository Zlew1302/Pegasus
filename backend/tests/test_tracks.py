"""Tests for Decision Tracks API + service functions."""

import pytest
import pytest_asyncio
from uuid import uuid4

from app.models.agent import AgentType, AgentInstance
from app.models.project import Project
from app.models.task import Task
from app.models.tracks import TrackPoint, EntityNode, EntityRelationship, WorkflowPattern
from app.services.track_service import (
    classify_system,
    classify_action,
    extract_entities,
)


# ── Unit Tests: Entity Extraction ────────────────────────────────


def test_classify_system_web_search():
    assert classify_system("web_search", {}) == "web"


def test_classify_system_knowledge():
    assert classify_system("knowledge_search", {}) == "knowledge_base"


def test_classify_system_internal_db():
    assert classify_system("read_project_context", {}) == "internal_db"


def test_classify_system_github_from_params():
    assert classify_system("custom_tool", {"url": "github.com/repo"}) == "github"


def test_classify_system_slack_from_params():
    assert classify_system("custom_tool", {"channel": "#engineering"}) == "slack"


def test_classify_system_unknown():
    assert classify_system("custom_tool", {"foo": "bar"}) == "unknown"


def test_classify_action_search():
    assert classify_action("web_search", {}) == "SearchAction"


def test_classify_action_read():
    assert classify_action("read_project_context", {}) == "ReadAction"


def test_classify_action_with_query_param():
    assert classify_action("custom_tool", {"query": "test"}) == "SearchAction"


def test_classify_action_default():
    assert classify_action("random_tool", {}) == "SearchAction"


def test_extract_entities_email():
    entities = extract_entities("tool", {}, "Contact john.doe@example.com for details")
    assert any(e["type"] == "Person" and "john doe" in e["name"].lower() for e in entities)


def test_extract_entities_github_repo():
    entities = extract_entities("tool", {}, "See https://github.com/org/repo for docs")
    assert any(e["type"] == "SoftwareSourceCode" and "org/repo" in e["name"] for e in entities)


def test_extract_entities_slack_channel():
    entities = extract_entities("tool", {}, "Posted in #engineering-backend")
    assert any(
        e["type"] == "CommunicationChannel" and "engineering-backend" in e["name"]
        for e in entities
    )


def test_extract_entities_mention():
    entities = extract_entities("tool", {}, "Asked @alice.smith about this")
    assert any(e["type"] == "Person" and "alice.smith" in e["name"] for e in entities)


def test_extract_entities_document():
    entities = extract_entities("tool", {}, "See report-2024.pdf attached")
    assert any(e["type"] == "DigitalDocument" and "pdf" in e["name"] for e in entities)


def test_extract_entities_url_domain():
    entities = extract_entities("tool", {}, "Found on https://docs.example.com/page")
    assert any(
        e["type"] == "SoftwareApplication" and "docs.example.com" in e["name"]
        for e in entities
    )


def test_extract_entities_cap_at_20():
    many_emails = " ".join(f"user{i}@example.com" for i in range(30))
    entities = extract_entities("tool", {}, many_emails)
    assert len(entities) <= 20


def test_extract_entities_dedup():
    entities = extract_entities(
        "tool", {}, "john@example.com and john@example.com again"
    )
    person_count = sum(1 for e in entities if "john" in e["name"].lower())
    assert person_count == 1


def test_extract_entities_empty():
    entities = extract_entities("tool", {}, "")
    assert entities == []


# ── API Tests ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_insights_empty(client):
    resp = await client.get("/api/tracks/insights")
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["total_entities"] == 0
    assert data["summary"]["total_relationships"] == 0
    assert data["summary"]["total_track_points"] == 0
    assert data["top_entities"] == []
    assert data["top_relationships"] == []


@pytest.mark.asyncio
async def test_get_patterns_empty(client):
    resp = await client.get("/api/tracks/patterns")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_entities_empty(client):
    resp = await client.get("/api/tracks/entities")
    assert resp.status_code == 200
    data = resp.json()
    assert data["nodes"] == []
    assert data["edges"] == []


@pytest.mark.asyncio
async def test_get_instance_tracks_empty(client):
    resp = await client.get("/api/tracks/instance/nonexistent-id")
    assert resp.status_code == 200
    data = resp.json()
    assert data["instance_id"] == "nonexistent-id"
    assert data["track_points"] == []
    assert data["total_points"] == 0


@pytest.mark.asyncio
async def test_get_insights_with_data(client, db_session):
    """Verify insights include seeded track data."""
    # Seed entities
    e1 = EntityNode(
        id=str(uuid4()),
        schema_type="Person",
        canonical_name="alice",
        occurrence_count=5,
    )
    e2 = EntityNode(
        id=str(uuid4()),
        schema_type="SoftwareApplication",
        canonical_name="github",
        occurrence_count=3,
    )
    db_session.add_all([e1, e2])
    await db_session.commit()

    resp = await client.get("/api/tracks/insights")
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["total_entities"] == 2
    assert len(data["top_entities"]) == 2
    # First should be alice (higher occurrence)
    assert data["top_entities"][0]["name"] == "alice"


@pytest.mark.asyncio
async def test_get_entities_with_filter(client, db_session):
    """Verify entity graph filter by schema_type."""
    e1 = EntityNode(
        id=str(uuid4()),
        schema_type="Person",
        canonical_name="bob",
        occurrence_count=2,
    )
    e2 = EntityNode(
        id=str(uuid4()),
        schema_type="SoftwareApplication",
        canonical_name="slack",
        occurrence_count=1,
    )
    db_session.add_all([e1, e2])
    await db_session.commit()

    # Filter by Person
    resp = await client.get("/api/tracks/entities?schema_type=Person")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["nodes"]) == 1
    assert data["nodes"][0]["name"] == "bob"


@pytest.mark.asyncio
async def test_get_patterns_with_data(client, db_session):
    """Verify patterns endpoint returns only patterns with frequency >= 2."""
    p1 = WorkflowPattern(
        id=str(uuid4()),
        label="web:SearchAction → knowledge_base:SearchAction",
        sequence_json='[{"system":"web","action":"SearchAction"},{"system":"knowledge_base","action":"SearchAction"}]',
        frequency=3,
        avg_signal_score=0.7,
        confidence=2.1,
    )
    p2 = WorkflowPattern(
        id=str(uuid4()),
        label="internal_db:ReadAction → web:SearchAction",
        sequence_json='[{"system":"internal_db","action":"ReadAction"},{"system":"web","action":"SearchAction"}]',
        frequency=1,  # Below threshold
        avg_signal_score=0.5,
        confidence=0.5,
    )
    db_session.add_all([p1, p2])
    await db_session.commit()

    resp = await client.get("/api/tracks/patterns")
    assert resp.status_code == 200
    data = resp.json()
    # Only p1 should be returned (frequency >= 2)
    assert len(data) == 1
    assert data[0]["frequency"] == 3


@pytest.mark.asyncio
async def test_insights_limit_parameter(client):
    resp = await client.get("/api/tracks/insights?limit=5")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_patterns_limit_parameter(client):
    resp = await client.get("/api/tracks/patterns?limit=3")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_entities_limit_parameter(client):
    resp = await client.get("/api/tracks/entities?limit=10")
    assert resp.status_code == 200
