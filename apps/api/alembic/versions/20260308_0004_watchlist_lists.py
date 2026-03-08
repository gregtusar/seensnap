"""watchlist list metadata

Revision ID: 20260308_0004
Revises: 20260308_0003
Create Date: 2026-03-08 22:45:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260308_0004"
down_revision = "20260308_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("watchlists", sa.Column("description", sa.String(length=280), nullable=True))
    op.add_column("watchlists", sa.Column("is_system_list", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute("UPDATE watchlists SET is_system_list = true WHERE is_default = true")
    op.alter_column("watchlists", "is_system_list", server_default=None)


def downgrade() -> None:
    op.drop_column("watchlists", "is_system_list")
    op.drop_column("watchlists", "description")

