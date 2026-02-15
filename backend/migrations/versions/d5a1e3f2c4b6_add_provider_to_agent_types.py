"""add_provider_to_agent_types

Revision ID: d5a1e3f2c4b6
Revises: c4f9d2e3b1a5
Create Date: 2026-02-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5a1e3f2c4b6'
down_revision: Union[str, None] = 'c4f9d2e3b1a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column already exists in a table."""
    conn = op.get_bind()
    result = conn.execute(sa.text(f"PRAGMA table_info({table_name})"))
    return any(row[1] == column_name for row in result.fetchall())


def upgrade() -> None:
    if not _column_exists('agent_types', 'provider'):
        op.add_column(
            'agent_types',
            sa.Column(
                'provider',
                sa.String(length=50),
                nullable=False,
                server_default='anthropic',
            ),
        )

    if not _column_exists('agent_types', 'provider_base_url'):
        op.add_column(
            'agent_types',
            sa.Column(
                'provider_base_url',
                sa.String(length=500),
                nullable=True,
            ),
        )


def downgrade() -> None:
    if _column_exists('agent_types', 'provider_base_url'):
        op.drop_column('agent_types', 'provider_base_url')
    if _column_exists('agent_types', 'provider'):
        op.drop_column('agent_types', 'provider')
