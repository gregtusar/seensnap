"""Add swipe records

Revision ID: 20260501_0006
Revises: 20260501_0005
Create Date: 2026-05-01 00:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260501_0006"
down_revision: str | None = "20260501_0005"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "swipe_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("direction", sa.String(length=12), nullable=False),
        sa.Column("pause_ms", sa.Integer(), nullable=True),
        sa.Column("session_id", sa.String(length=80), nullable=True),
        sa.Column("reason", sa.String(length=280), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["content_title_id"], ["content_titles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_swipe_records_user_created", "swipe_records", ["user_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_swipe_records_user_created", table_name="swipe_records")
    op.drop_table("swipe_records")
