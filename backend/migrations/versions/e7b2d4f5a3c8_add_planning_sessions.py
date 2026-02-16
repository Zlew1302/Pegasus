"""add_planning_sessions

Revision ID: e7b2d4f5a3c8
Revises: d5a1e3f2c4b6
Create Date: 2026-02-15 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7b2d4f5a3c8'
down_revision: Union[str, None] = 'd5a1e3f2c4b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """Check if a table already exists."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    if not _table_exists('planning_sessions'):
        op.create_table(
            'planning_sessions',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('project_id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='input'),
            sa.Column('input_mode', sa.String(length=20), nullable=False, server_default='project_overview'),
            sa.Column('user_notes', sa.Text(), nullable=True),
            sa.Column('knowledge_doc_ids', sa.Text(), nullable=True),
            sa.Column('web_search_topics', sa.Text(), nullable=True),
            sa.Column('web_search_results', sa.Text(), nullable=True),
            sa.Column('auto_context', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('generated_plan', sa.Text(), nullable=True),
            sa.Column('confirmed_plan', sa.Text(), nullable=True),
            sa.Column('agent_instance_id', sa.String(length=36), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_planning_sessions_project_id', 'planning_sessions', ['project_id'])
        op.create_index('ix_planning_sessions_status', 'planning_sessions', ['status'])


def downgrade() -> None:
    if _table_exists('planning_sessions'):
        op.drop_index('ix_planning_sessions_status', table_name='planning_sessions')
        op.drop_index('ix_planning_sessions_project_id', table_name='planning_sessions')
        op.drop_table('planning_sessions')
