import logging
import re
from dataclasses import dataclass, field

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.document import Block, Document
from app.models.project import Project
from app.models.task import Task
from app.schemas.search import SearchResult

logger = logging.getLogger(__name__)

# Pattern: key:value pairs in query string
_OPERATOR_RE = re.compile(r"(\w+):(\S+)")


@dataclass
class ParsedQuery:
    text: str = ""
    filters: dict[str, str] = field(default_factory=dict)


def parse_query(q: str) -> ParsedQuery:
    """Extract operator filters from query string."""
    filters: dict[str, str] = {}
    text_parts: list[str] = []

    for token in q.split():
        match = _OPERATOR_RE.fullmatch(token)
        if match:
            filters[match.group(1).lower()] = match.group(2)
        else:
            text_parts.append(token)

    return ParsedQuery(text=" ".join(text_parts), filters=filters)


async def search_all(
    parsed: ParsedQuery,
    user_id: str,
    search_type: str | None,
    status_filter: str | None,
    priority_filter: str | None,
    project_id_filter: str | None,
    limit: int,
    db: AsyncSession,
) -> list[SearchResult]:
    """Search across tasks, projects, documents, comments."""
    results: list[SearchResult] = []
    pattern = f"%{parsed.text}%" if parsed.text else "%"

    # Apply operator filters
    effective_status = parsed.filters.get("status", status_filter)
    effective_priority = parsed.filters.get("priority", priority_filter)
    effective_type = parsed.filters.get("type", search_type)

    # --- Search Tasks ---
    if not effective_type or effective_type == "task":
        task_q = (
            select(Task, Project.title.label("project_title"))
            .outerjoin(Project, Task.project_id == Project.id)
            .where(Project.owner_id == user_id)
        )
        if parsed.text:
            task_q = task_q.where(
                or_(
                    Task.title.ilike(pattern),
                    Task.description.ilike(pattern),
                    Task.acceptance_criteria.ilike(pattern),
                )
            )
        if effective_status:
            task_q = task_q.where(Task.status == effective_status)
        if effective_priority:
            task_q = task_q.where(Task.priority == effective_priority)
        if project_id_filter:
            task_q = task_q.where(Task.project_id == project_id_filter)

        task_q = task_q.limit(limit)
        task_result = await db.execute(task_q)

        for task, proj_title in task_result.all():
            snippet = None
            if task.description:
                snippet = task.description[:120]
            score = 2.0 if parsed.text and parsed.text.lower() in (task.title or "").lower() else 1.0
            results.append(
                SearchResult(
                    type="task",
                    id=task.id,
                    title=task.title,
                    snippet=snippet,
                    project_name=proj_title,
                    status=task.status,
                    score=score,
                )
            )

    # --- Search Projects ---
    if not effective_type or effective_type == "project":
        proj_q = select(Project).where(Project.owner_id == user_id)
        if parsed.text:
            proj_q = proj_q.where(
                or_(
                    Project.title.ilike(pattern),
                    Project.description.ilike(pattern),
                    Project.goal.ilike(pattern),
                )
            )
        if effective_status:
            proj_q = proj_q.where(Project.status == effective_status)

        proj_q = proj_q.limit(limit)
        proj_result = await db.execute(proj_q)

        for p in proj_result.scalars().all():
            snippet = p.description[:120] if p.description else None
            score = 2.0 if parsed.text and parsed.text.lower() in (p.title or "").lower() else 1.0
            results.append(
                SearchResult(
                    type="project",
                    id=p.id,
                    title=p.title,
                    snippet=snippet,
                    status=p.status,
                    score=score,
                )
            )

    # --- Search Documents ---
    if not effective_type or effective_type == "document":
        doc_q = (
            select(Document, Project.title.label("project_title"))
            .join(Project, Document.project_id == Project.id)
            .where(Project.owner_id == user_id)
        )
        if parsed.text:
            doc_q = doc_q.where(Document.title.ilike(pattern))
        if project_id_filter:
            doc_q = doc_q.where(Document.project_id == project_id_filter)

        doc_q = doc_q.limit(limit)
        doc_result = await db.execute(doc_q)

        for doc, proj_title in doc_result.all():
            # Try to find snippet in blocks
            block_result = await db.execute(
                select(Block.content)
                .where(Block.document_id == doc.id, Block.content.ilike(pattern))
                .limit(1)
            )
            block_content = block_result.scalar_one_or_none()
            snippet = block_content[:120] if block_content else None
            score = 2.0 if parsed.text and parsed.text.lower() in (doc.title or "").lower() else 1.0
            results.append(
                SearchResult(
                    type="document",
                    id=doc.id,
                    title=doc.title,
                    snippet=snippet,
                    project_name=proj_title,
                    score=score,
                )
            )

    # --- Search Comments ---
    if not effective_type or effective_type == "comment":
        if parsed.text:
            comment_q = (
                select(Comment, Task.title.label("task_title"))
                .join(Task, Comment.task_id == Task.id)
                .join(Project, Task.project_id == Project.id)
                .where(Project.owner_id == user_id)
                .where(Comment.content.ilike(pattern))
                .limit(limit)
            )
            comment_result = await db.execute(comment_q)

            for c, task_title in comment_result.all():
                snippet = c.content[:120]
                results.append(
                    SearchResult(
                        type="comment",
                        id=c.id,
                        title=f"Kommentar in: {task_title}",
                        snippet=snippet,
                        score=0.8,
                    )
                )

    # Sort by score desc
    results.sort(key=lambda r: r.score, reverse=True)
    return results[:limit]
