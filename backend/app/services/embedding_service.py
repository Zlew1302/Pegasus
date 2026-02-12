"""Embedding service — generates vector embeddings using local sentence-transformers.

Uses all-MiniLM-L6-v2 (384 dimensions) for fast, free, offline embeddings.
Same model as the Orion project.
"""

import json
import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

EMBED_MODEL = "all-MiniLM-L6-v2"
EMBED_DIM = 384

# Lazy-loaded model singleton
_model = None


def _get_model():
    """Lazy-load the sentence-transformers model (first call downloads ~80MB)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        logger.info(f"Loading embedding model: {EMBED_MODEL}")
        _model = SentenceTransformer(EMBED_MODEL)
        logger.info(f"Embedding model loaded ({EMBED_DIM} dimensions)")
    return _model


async def embed_texts(
    texts: list[str],
    input_type: str = "document",
) -> list[Optional[list[float]]]:
    """Embed a list of texts using local sentence-transformers.

    Args:
        texts: List of text strings to embed.
        input_type: Ignored for local model (kept for API compatibility).

    Returns:
        List of embedding vectors (or None for failed items).
    """
    if not texts:
        return []

    try:
        model = _get_model()
        embeddings = model.encode(
            texts,
            normalize_embeddings=True,  # L2 normalize for cosine similarity via dot product
            show_progress_bar=False,
            batch_size=32,
        )

        return [emb.tolist() for emb in embeddings]

    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        return [None] * len(texts)


async def embed_query(query: str) -> Optional[list[float]]:
    """Embed a single search query."""
    results = await embed_texts([query], input_type="query")
    return results[0] if results else None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors.

    Since embeddings are L2-normalized, dot product = cosine similarity.
    """
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)

    dot = np.dot(va, vb)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot / (norm_a * norm_b))


def serialize_embedding(embedding: list[float]) -> str:
    """Serialize embedding vector to JSON string for SQLite storage."""
    return json.dumps(embedding)


def deserialize_embedding(data: str) -> list[float]:
    """Deserialize embedding vector from JSON string."""
    return json.loads(data)
