"""add_owner_id_to_projects

Revision ID: b3e7c8d1a2f0
Revises: acc55650f4b4
Create Date: 2026-02-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3e7c8d1a2f0'
down_revision: Union[str, None] = 'acc55650f4b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column already exists in a table."""
    conn = op.get_bind()
    result = conn.execute(sa.text(f"PRAGMA table_info({table_name})"))
    return any(row[1] == column_name for row in result.fetchall())


def upgrade() -> None:
    if not _column_exists('projects', 'owner_id'):
        # Add owner_id with default for existing rows
        op.add_column(
            'projects',
            sa.Column(
                'owner_id',
                sa.String(length=36),
                nullable=False,
                server_default='default-user',
            ),
        )


def downgrade() -> None:
    op.drop_column('projects', 'owner_id')
