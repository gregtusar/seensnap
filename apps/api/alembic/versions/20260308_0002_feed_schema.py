"""feed schema

Revision ID: 20260308_0002
Revises: 20260307_0001
Create Date: 2026-03-08 11:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260308_0002"
down_revision = "20260307_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feed_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id")),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id")),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True)),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_feed_events_created_at", "feed_events", ["created_at"])
    op.create_index("ix_feed_events_team_created_at", "feed_events", ["team_id", "created_at"])
    op.create_index("ix_feed_events_actor_created_at", "feed_events", ["actor_user_id", "created_at"])

    op.create_table(
        "feed_reactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("feed_events.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reaction", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("event_id", "user_id", name="uq_feed_reaction_event_user"),
    )
    op.create_index("ix_feed_reactions_event_id", "feed_reactions", ["event_id"])
    op.execute(
        """
        CREATE TRIGGER feed_reactions_set_updated_at
        BEFORE UPDATE ON feed_reactions
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )

    op.create_table(
        "feed_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("feed_events.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("parent_comment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("feed_comments.id")),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_feed_comments_event_created_at", "feed_comments", ["event_id", "created_at"])
    op.execute(
        """
        CREATE TRIGGER feed_comments_set_updated_at
        BEFORE UPDATE ON feed_comments
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS feed_comments_set_updated_at ON feed_comments;")
    op.drop_index("ix_feed_comments_event_created_at", table_name="feed_comments")
    op.drop_table("feed_comments")

    op.execute("DROP TRIGGER IF EXISTS feed_reactions_set_updated_at ON feed_reactions;")
    op.drop_index("ix_feed_reactions_event_id", table_name="feed_reactions")
    op.drop_table("feed_reactions")

    op.drop_index("ix_feed_events_actor_created_at", table_name="feed_events")
    op.drop_index("ix_feed_events_team_created_at", table_name="feed_events")
    op.drop_index("ix_feed_events_created_at", table_name="feed_events")
    op.drop_table("feed_events")
