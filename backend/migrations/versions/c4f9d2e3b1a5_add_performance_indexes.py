"""add_performance_indexes

Revision ID: c4f9d2e3b1a5
Revises: b3e7c8d1a2f0
Create Date: 2026-02-12 10:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4f9d2e3b1a5'
down_revision: Union[str, None] = 'b3e7c8d1a2f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(index_name: str) -> bool:
    """Check if an index already exists."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='index' AND name=:name"),
        {"name": index_name},
    )
    return result.fetchone() is not None


def _table_exists(table_name: str) -> bool:
    """Check if a table already exists."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    )
    return result.fetchone() is not None


def _safe_create_index(index_name: str, table_name: str, columns: list[str]) -> None:
    """Create an index only if the table exists and the index doesn't."""
    if _table_exists(table_name) and not _index_exists(index_name):
        op.create_index(index_name, table_name, columns)


def upgrade() -> None:
    # Tasks — most queried table
    _safe_create_index('ix_tasks_project_id', 'tasks', ['project_id'])
    _safe_create_index('ix_tasks_status', 'tasks', ['status'])
    _safe_create_index('ix_tasks_project_status', 'tasks', ['project_id', 'status'])

    # Projects — owner scoping
    _safe_create_index('ix_projects_owner_id', 'projects', ['owner_id'])

    # Agent instances — status queries and task lookups
    _safe_create_index('ix_agent_instances_task_id', 'agent_instances', ['task_id'])
    _safe_create_index('ix_agent_instances_status', 'agent_instances', ['status'])

    # Knowledge documents — user scoping and status filters
    # (Tables created at runtime by create_all, may not exist during migration)
    _safe_create_index('ix_knowledge_docs_user_id', 'knowledge_documents', ['user_id'])
    _safe_create_index('ix_knowledge_docs_user_status', 'knowledge_documents', ['user_id', 'status'])
    _safe_create_index('ix_knowledge_docs_project_id', 'knowledge_documents', ['project_id'])

    # Knowledge chunks — document lookups for RAG
    _safe_create_index('ix_knowledge_chunks_document_id', 'knowledge_chunks', ['document_id'])


def downgrade() -> None:
    op.drop_index('ix_knowledge_chunks_document_id', 'knowledge_chunks')
    op.drop_index('ix_knowledge_docs_project_id', 'knowledge_documents')
    op.drop_index('ix_knowledge_docs_user_status', 'knowledge_documents')
    op.drop_index('ix_knowledge_docs_user_id', 'knowledge_documents')
    op.drop_index('ix_agent_instances_status', 'agent_instances')
    op.drop_index('ix_agent_instances_task_id', 'agent_instances')
    op.drop_index('ix_projects_owner_id', 'projects')
    op.drop_index('ix_tasks_project_status', 'tasks')
    op.drop_index('ix_tasks_status', 'tasks')
    op.drop_index('ix_tasks_project_id', 'tasks')
