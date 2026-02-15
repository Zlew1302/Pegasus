"""add_soft_delete_columns

Revision ID: e7b2d4f1a3c8
Revises: d5a1e3f2c4b6
Create Date: 2026-02-15 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7b2d4f1a3c8'
down_revision: Union[str, None] = 'd5a1e3f2c4b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column already exists in a table."""
    conn = op.get_bind()
    result = conn.execute(sa.text(f"PRAGMA table_info({table_name})"))
    return any(row[1] == column_name for row in result.fetchall())


def upgrade() -> None:
    if not _column_exists('agent_instances', 'deleted_at'):
        op.add_column(
            'agent_instances',
            sa.Column('deleted_at', sa.DateTime(), nullable=True),
        )
    if not _column_exists('projects', 'deleted_at'):
        op.add_column(
            'projects',
            sa.Column('deleted_at', sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column('projects', 'deleted_at')
    op.drop_column('agent_instances', 'deleted_at')
