"""taste graph foundation

Revision ID: 20260501_0005
Revises: 20260308_0004
Create Date: 2026-05-01 20:02:35.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260501_0005"
down_revision = "20260308_0004"
branch_labels = None
depends_on = None


JSONB = postgresql.JSONB(astext_type=sa.Text())
UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "user_taste_profiles",
        sa.Column("user_id", UUID, sa.ForeignKey("users.id"), primary_key=True, nullable=False),
        sa.Column("top_genres", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("top_themes", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("top_platforms", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("favorite_eras", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("taste_labels", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("profile_summary", sa.String(length=512), nullable=True),
        sa.Column("current_obsessions", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("top_posters", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("most_saved_genre", sa.String(length=120), nullable=True),
        sa.Column("signal_counts", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "compatibility_scores",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("user_a_id", UUID, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("user_b_id", UUID, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("compatibility", sa.Integer(), nullable=False),
        sa.Column("shared_genres", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("shared_titles", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("shared_labels", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("shared_platforms", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("summary", sa.String(length=280), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_a_id", "user_b_id", name="uq_compatibility_pair"),
    )
    op.create_table(
        "team_analytics",
        sa.Column("team_id", UUID, sa.ForeignKey("teams.id"), primary_key=True, nullable=False),
        sa.Column("member_ids", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("average_compatibility", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("most_aligned_pair", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("most_divisive_member", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("taste_mvp", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("most_loved_title", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("most_divisive_title", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("genre_breakdown", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("activity_snapshot", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "recommendation_signals",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_title_id", UUID, sa.ForeignKey("content_titles.id"), nullable=False),
        sa.Column("signal_type", sa.String(length=32), nullable=False),
        sa.Column("weight", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reason", sa.String(length=280), nullable=True),
        sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "wrapped_stats",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("top_genre", sa.String(length=120), nullable=True),
        sa.Column("most_saved_title", sa.String(length=255), nullable=True),
        sa.Column("favorite_platform", sa.String(length=120), nullable=True),
        sa.Column("titles_saved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reactions_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("top_label", sa.String(length=120), nullable=True),
        sa.Column("stats", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "year", name="uq_wrapped_user_year"),
    )
    op.create_index("ix_compatibility_scores_user_a_id", "compatibility_scores", ["user_a_id"])
    op.create_index("ix_compatibility_scores_user_b_id", "compatibility_scores", ["user_b_id"])
    op.create_index("ix_recommendation_signals_user_id", "recommendation_signals", ["user_id"])
    op.create_index("ix_wrapped_stats_user_id", "wrapped_stats", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_wrapped_stats_user_id", table_name="wrapped_stats")
    op.drop_index("ix_recommendation_signals_user_id", table_name="recommendation_signals")
    op.drop_index("ix_compatibility_scores_user_b_id", table_name="compatibility_scores")
    op.drop_index("ix_compatibility_scores_user_a_id", table_name="compatibility_scores")
    op.drop_table("wrapped_stats")
    op.drop_table("recommendation_signals")
    op.drop_table("team_analytics")
    op.drop_table("compatibility_scores")
    op.drop_table("user_taste_profiles")
