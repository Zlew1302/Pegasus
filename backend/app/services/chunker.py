"""Semantic chunker — splits documents into coherent chunks for embedding.

Adapted from the Orion project's SemanticChunker.
Uses paragraph → sentence → force-split hierarchy.
"""

import re
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4


@dataclass
class ChunkResult:
    """A single text chunk with position tracking."""
    id: str
    content: str
    chunk_index: int
    start_index: int
    end_index: int
    metadata: dict[str, Any] = field(default_factory=dict)


# Default settings
DEFAULT_CHUNK_SIZE = 512
DEFAULT_CHUNK_OVERLAP = 50

# Patterns
_SENTENCE_PATTERN = re.compile(r"(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s*\n")
_PARAGRAPH_PATTERN = re.compile(r"\n\s*\n")
_HEADING_PATTERN = re.compile(r"^#{1,6}\s+.+$", re.MULTILINE)


def chunk_text(
    content: str,
    doc_type: str = "text",
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[ChunkResult]:
    """Split content into semantic chunks.

    Args:
        content: The text content to chunk.
        doc_type: Document type for specialized handling ("markdown" gets heading-aware splitting).
        chunk_size: Maximum characters per chunk.
        chunk_overlap: Overlap between consecutive chunks.

    Returns:
        List of ChunkResult objects.
    """
    if not content or not content.strip():
        return []

    if doc_type == "markdown":
        return _chunk_markdown(content, chunk_size, chunk_overlap)
    else:
        return _chunk_plain(content, chunk_size, chunk_overlap)


def _chunk_plain(
    content: str,
    chunk_size: int,
    chunk_overlap: int,
) -> list[ChunkResult]:
    """Chunk plain text using paragraph and sentence boundaries."""
    chunks: list[ChunkResult] = []
    paragraphs = _PARAGRAPH_PATTERN.split(content)

    current_chunk = ""
    current_start = 0
    chunk_start = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            current_start += 2
            continue

        if len(current_chunk) + len(para) + 2 > chunk_size:
            if current_chunk:
                chunks.append(_create_chunk(
                    content=current_chunk.strip(),
                    chunk_index=len(chunks),
                    start_index=chunk_start,
                    end_index=chunk_start + len(current_chunk.strip()),
                ))
                overlap_text = _get_overlap_text(current_chunk, chunk_overlap)
                if overlap_text:
                    current_chunk = overlap_text + "\n\n" + para
                    chunk_start = current_start - len(overlap_text)
                else:
                    current_chunk = para
                    chunk_start = current_start
            else:
                sentence_chunks = _split_large_paragraph(
                    para, current_start, chunk_size, len(chunks)
                )
                chunks.extend(sentence_chunks)
                current_chunk = ""
                chunk_start = current_start + len(para) + 2
        else:
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para
                chunk_start = current_start

        current_start += len(para) + 2

    if current_chunk.strip():
        chunks.append(_create_chunk(
            content=current_chunk.strip(),
            chunk_index=len(chunks),
            start_index=chunk_start,
            end_index=chunk_start + len(current_chunk.strip()),
        ))

    return chunks


def _chunk_markdown(
    content: str,
    chunk_size: int,
    chunk_overlap: int,
) -> list[ChunkResult]:
    """Chunk markdown using heading structure."""
    heading_matches = list(_HEADING_PATTERN.finditer(content))

    if not heading_matches:
        return _chunk_plain(content, chunk_size, chunk_overlap)

    sections: list[tuple[str, int, int]] = []

    # Content before first heading
    if heading_matches[0].start() > 0:
        pre = content[:heading_matches[0].start()].strip()
        if pre:
            sections.append((pre, 0, heading_matches[0].start()))

    for i, match in enumerate(heading_matches):
        start = match.start()
        end = heading_matches[i + 1].start() if i + 1 < len(heading_matches) else len(content)
        section_content = content[start:end].strip()
        if section_content:
            sections.append((section_content, start, end))

    chunks: list[ChunkResult] = []
    for section_content, section_start, _section_end in sections:
        if len(section_content) <= chunk_size:
            chunks.append(_create_chunk(
                content=section_content,
                chunk_index=len(chunks),
                start_index=section_start,
                end_index=section_start + len(section_content),
                metadata={"is_section": True},
            ))
        else:
            sub_chunks = _chunk_plain(section_content, chunk_size, chunk_overlap)
            for sc in sub_chunks:
                sc.start_index += section_start
                sc.end_index += section_start
                sc.chunk_index = len(chunks)
                chunks.append(sc)

    return chunks


def _split_large_paragraph(
    paragraph: str,
    start_offset: int,
    chunk_size: int,
    base_index: int,
) -> list[ChunkResult]:
    """Split a large paragraph by sentences."""
    chunks: list[ChunkResult] = []
    sentences = _SENTENCE_PATTERN.split(paragraph)

    current_chunk = ""
    current_start = start_offset

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(current_chunk) + len(sentence) + 1 > chunk_size:
            if current_chunk:
                chunks.append(_create_chunk(
                    content=current_chunk.strip(),
                    chunk_index=base_index + len(chunks),
                    start_index=current_start,
                    end_index=current_start + len(current_chunk.strip()),
                ))
                current_chunk = sentence
                current_start = start_offset + paragraph.find(sentence)
            else:
                # Single sentence too large — force split
                for i in range(0, len(sentence), chunk_size):
                    chunk_text = sentence[i:i + chunk_size]
                    chunks.append(_create_chunk(
                        content=chunk_text,
                        chunk_index=base_index + len(chunks),
                        start_index=current_start + i,
                        end_index=current_start + i + len(chunk_text),
                        metadata={"force_split": True},
                    ))
        else:
            if current_chunk:
                current_chunk += " " + sentence
            else:
                current_chunk = sentence

    if current_chunk.strip():
        chunks.append(_create_chunk(
            content=current_chunk.strip(),
            chunk_index=base_index + len(chunks),
            start_index=current_start,
            end_index=current_start + len(current_chunk.strip()),
        ))

    return chunks


def _get_overlap_text(text: str, overlap: int) -> str:
    """Get overlap text from the end of a chunk (sentence-boundary aware)."""
    if overlap <= 0:
        return ""

    sentences = _SENTENCE_PATTERN.split(text)
    if len(sentences) < 2:
        return text[-overlap:] if len(text) > overlap else ""

    overlap_text = ""
    for sentence in reversed(sentences):
        if len(overlap_text) + len(sentence) <= overlap:
            overlap_text = sentence + " " + overlap_text
        else:
            break

    return overlap_text.strip()


def _create_chunk(
    content: str,
    chunk_index: int,
    start_index: int,
    end_index: int,
    metadata: dict[str, Any] | None = None,
) -> ChunkResult:
    return ChunkResult(
        id=str(uuid4()),
        content=content,
        chunk_index=chunk_index,
        start_index=start_index,
        end_index=end_index,
        metadata=metadata or {},
    )
