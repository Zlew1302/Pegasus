"""phase_a_schema

Revision ID: acc55650f4b4
Revises: f6cbca61a9c9
Create Date: 2026-02-11 17:42:06.607480

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'acc55650f4b4'
down_revision: Union[str, None] = 'f6cbca61a9c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """Check if a table already exists (handles partial migration retries)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    )
    return result.fetchone() is not None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column already exists in a table."""
    conn = op.get_bind()
    result = conn.execute(sa.text(f"PRAGMA table_info({table_name})"))
    return any(row[1] == column_name for row in result.fetchall())


def upgrade() -> None:
    # New tables — idempotent with existence checks
    if not _table_exists('api_keys'):
        op.create_table('api_keys',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('key_name', sa.String(length=100), nullable=False),
        sa.Column('key_encrypted', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )

    if not _table_exists('teams'):
        op.create_table('teams',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )

    if not _table_exists('user_profiles'):
        op.create_table('user_profiles',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('global_system_prompt', sa.Text(), nullable=True),
        sa.Column('preferences_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )

    if not _table_exists('user_settings'):
        op.create_table('user_settings',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value_json', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key')
        )

    if not _table_exists('project_budgets'):
        op.create_table('project_budgets',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('budget_cents', sa.Integer(), nullable=False),
        sa.Column('spent_cents', sa.Integer(), nullable=False),
        sa.Column('alert_threshold_percent', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
        )

    if not _table_exists('team_members'):
        op.create_table('team_members',
        sa.Column('team_id', sa.String(length=36), nullable=False),
        sa.Column('member_type', sa.String(length=10), nullable=False),
        sa.Column('member_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
        sa.PrimaryKeyConstraint('team_id', 'member_id')
        )

    if not _table_exists('user_todos'):
        op.create_table('user_todos',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('is_completed', sa.Boolean(), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
        )

    # Add columns to projects — idempotent
    if not _column_exists('projects', 'phase'):
        op.add_column('projects', sa.Column('phase', sa.String(length=50), nullable=True))
    if not _column_exists('projects', 'start_date'):
        op.add_column('projects', sa.Column('start_date', sa.DateTime(), nullable=True))
    if not _column_exists('projects', 'end_date'):
        op.add_column('projects', sa.Column('end_date', sa.DateTime(), nullable=True))
    if not _column_exists('projects', 'budget_cents'):
        op.add_column('projects', sa.Column('budget_cents', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('projects', 'budget_cents')
    op.drop_column('projects', 'end_date')
    op.drop_column('projects', 'start_date')
    op.drop_column('projects', 'phase')
    op.drop_table('user_todos')
    op.drop_table('team_members')
    op.drop_table('project_budgets')
    op.drop_table('user_settings')
    op.drop_table('user_profiles')
    op.drop_table('teams')
    op.drop_table('api_keys')
