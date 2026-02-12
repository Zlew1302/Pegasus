import pytest
from httpx import AsyncClient


@pytest.fixture
async def sample_project(client: AsyncClient) -> dict:
    resp = await client.post(
        "/api/projects",
        json={"title": "Docs Projekt", "description": "Fuer Document-Tests"},
    )
    return resp.json()


@pytest.fixture
async def sample_document(client: AsyncClient, sample_project: dict) -> dict:
    resp = await client.post(
        f"/api/projects/{sample_project['id']}/documents",
        json={"title": "Testdokument"},
    )
    return resp.json()


# ── Document CRUD ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_document(client: AsyncClient, sample_project: dict):
    resp = await client.post(
        f"/api/projects/{sample_project['id']}/documents",
        json={"title": "Neues Dokument", "icon": "📝"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Neues Dokument"
    assert data["icon"] == "📝"
    assert data["project_id"] == sample_project["id"]
    assert data["is_pinned"] is False
    # Should have one initial empty paragraph block
    assert len(data["blocks"]) == 1
    assert data["blocks"][0]["block_type"] == "paragraph"
    assert data["blocks"][0]["content"] == ""


@pytest.mark.asyncio
async def test_create_document_project_not_found(client: AsyncClient):
    resp = await client.post(
        "/api/projects/nonexistent/documents",
        json={"title": "Test"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_documents(client: AsyncClient, sample_project: dict):
    await client.post(
        f"/api/projects/{sample_project['id']}/documents",
        json={"title": "Dok A"},
    )
    await client.post(
        f"/api/projects/{sample_project['id']}/documents",
        json={"title": "Dok B"},
    )

    resp = await client.get(
        f"/api/projects/{sample_project['id']}/documents"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    # Each should have block_count
    for doc in data:
        assert "block_count" in doc


@pytest.mark.asyncio
async def test_get_document_with_blocks(
    client: AsyncClient, sample_document: dict
):
    doc_id = sample_document["id"]
    resp = await client.get(f"/api/documents/{doc_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == doc_id
    assert "blocks" in data
    assert len(data["blocks"]) >= 1


@pytest.mark.asyncio
async def test_get_document_not_found(client: AsyncClient):
    resp = await client.get("/api/documents/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_document(client: AsyncClient, sample_document: dict):
    doc_id = sample_document["id"]
    resp = await client.patch(
        f"/api/documents/{doc_id}",
        json={"title": "Neuer Titel", "is_pinned": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Neuer Titel"
    assert data["is_pinned"] is True


@pytest.mark.asyncio
async def test_delete_document(client: AsyncClient, sample_document: dict):
    doc_id = sample_document["id"]
    resp = await client.delete(f"/api/documents/{doc_id}")
    assert resp.status_code == 204

    # Verify deleted
    resp = await client.get(f"/api/documents/{doc_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_document_cascades_blocks(
    client: AsyncClient, sample_document: dict
):
    doc_id = sample_document["id"]
    block_id = sample_document["blocks"][0]["id"]

    resp = await client.delete(f"/api/documents/{doc_id}")
    assert resp.status_code == 204

    # Block should also be deleted
    resp = await client.patch(
        f"/api/blocks/{block_id}",
        json={"content": "Should fail"},
    )
    assert resp.status_code == 404


# ── Block CRUD ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_block(client: AsyncClient, sample_document: dict):
    doc_id = sample_document["id"]
    resp = await client.post(
        f"/api/documents/{doc_id}/blocks",
        json={
            "block_type": "heading_1",
            "content": "Ueberschrift",
            "sort_order": 1,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["block_type"] == "heading_1"
    assert data["content"] == "Ueberschrift"
    assert data["document_id"] == doc_id


@pytest.mark.asyncio
async def test_update_block(client: AsyncClient, sample_document: dict):
    block_id = sample_document["blocks"][0]["id"]
    resp = await client.patch(
        f"/api/blocks/{block_id}",
        json={"content": "Aktualisierter Text", "block_type": "quote"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "Aktualisierter Text"
    assert data["block_type"] == "quote"


@pytest.mark.asyncio
async def test_update_block_not_found(client: AsyncClient):
    resp = await client.patch(
        "/api/blocks/nonexistent",
        json={"content": "Test"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_block(client: AsyncClient, sample_document: dict):
    block_id = sample_document["blocks"][0]["id"]
    resp = await client.delete(f"/api/blocks/{block_id}")
    assert resp.status_code == 204

    # Verify deleted
    resp = await client.patch(
        f"/api/blocks/{block_id}",
        json={"content": "Should fail"},
    )
    assert resp.status_code == 404


# ── Reorder ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reorder_blocks(client: AsyncClient, sample_document: dict):
    doc_id = sample_document["id"]

    # Add two more blocks
    r1 = await client.post(
        f"/api/documents/{doc_id}/blocks",
        json={"block_type": "heading_1", "content": "H1", "sort_order": 1},
    )
    r2 = await client.post(
        f"/api/documents/{doc_id}/blocks",
        json={"block_type": "paragraph", "content": "P2", "sort_order": 2},
    )

    block_a = sample_document["blocks"][0]["id"]
    block_b = r1.json()["id"]
    block_c = r2.json()["id"]

    # Reverse the order
    resp = await client.patch(
        f"/api/documents/{doc_id}/blocks/reorder",
        json={
            "positions": [
                {"id": block_c, "sort_order": 0},
                {"id": block_b, "sort_order": 1},
                {"id": block_a, "sort_order": 2},
            ]
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["id"] == block_c
    assert data[1]["id"] == block_b
    assert data[2]["id"] == block_a


# ── Recent Documents ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_recent_documents(client: AsyncClient, sample_project: dict):
    # Create a few documents
    await client.post(
        f"/api/projects/{sample_project['id']}/documents",
        json={"title": "Recent A"},
    )
    await client.post(
        f"/api/projects/{sample_project['id']}/documents",
        json={"title": "Recent B"},
    )

    resp = await client.get("/api/documents/recent?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2
    titles = {d["title"] for d in data}
    assert "Recent A" in titles
    assert "Recent B" in titles
