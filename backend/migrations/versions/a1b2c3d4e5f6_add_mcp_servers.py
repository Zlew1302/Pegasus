"""add_mcp_servers

Revision ID: a1b2c3d4e5f6
Revises: e7b2d4f5a3c8
Create Date: 2026-02-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e7b2d4f5a3c8'
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
    if not _table_exists('mcp_servers'):
        op.create_table(
            'mcp_servers',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('slug', sa.String(50), nullable=False, unique=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('server_url', sa.String(500), nullable=False),
            sa.Column('auth_type', sa.String(20), nullable=False, server_default='none'),
            sa.Column('auth_token_encrypted', sa.Text(), nullable=True),
            sa.Column('icon', sa.String(50), nullable=False, server_default='plug'),
            sa.Column('is_connected', sa.Boolean(), nullable=False, server_default=sa.text('0')),
            sa.Column('available_tools', sa.Text(), nullable=True),
            sa.Column('last_health_check', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index('ix_mcp_servers_slug', 'mcp_servers', ['slug'], unique=True)
        op.create_index('ix_mcp_servers_is_connected', 'mcp_servers', ['is_connected'])


def downgrade() -> None:
    op.drop_index('ix_mcp_servers_is_connected', table_name='mcp_servers')
    op.drop_index('ix_mcp_servers_slug', table_name='mcp_servers')
    op.drop_table('mcp_servers')
