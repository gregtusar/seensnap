"""initial schema

Revision ID: 20260307_0001
Revises:
Create Date: 2026-03-07 12:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260307_0001"
down_revision = None
branch_labels = None
depends_on = None


def create_updated_at_trigger() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def add_updated_at_trigger(table_name: str) -> None:
    op.execute(
        f"""
        CREATE TRIGGER {table_name}_set_updated_at
        BEFORE UPDATE ON {table_name}
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def upgrade() -> None:
    create_updated_at_trigger()

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("auth_provider", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    add_updated_at_trigger("users")

    op.create_table(
        "auth_identities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_subject", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("provider", "provider_subject", name="uq_auth_identity_provider_subject"),
    )
    add_updated_at_trigger("auth_identities")

    op.create_table(
        "user_profiles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("username", sa.String(length=40), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("avatar_url", sa.String(length=512)),
        sa.Column("favorite_genres", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("bio", sa.String(length=280)),
        sa.Column("country_code", sa.String(length=2), nullable=False, server_default="US"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    add_updated_at_trigger("user_profiles")

    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("push_token", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    add_updated_at_trigger("devices")

    op.create_table(
        "content_titles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tmdb_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("content_type", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("original_title", sa.String(length=255)),
        sa.Column("overview", sa.Text()),
        sa.Column("poster_url", sa.String(length=512)),
        sa.Column("backdrop_url", sa.String(length=512)),
        sa.Column("release_date", sa.Date()),
        sa.Column("tmdb_vote_average", sa.Numeric(3, 1)),
        sa.Column("genres", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("runtime_minutes", sa.Integer()),
        sa.Column("season_count", sa.Integer()),
        sa.Column("metadata_raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    add_updated_at_trigger("content_titles")

    op.create_table(
        "content_availability",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id"), nullable=False),
        sa.Column("provider_code", sa.String(length=64), nullable=False),
        sa.Column("provider_name", sa.String(length=128), nullable=False),
        sa.Column("region_code", sa.String(length=2), nullable=False, server_default="US"),
        sa.Column("deeplink_url", sa.String(length=512)),
        sa.Column("web_url", sa.String(length=512)),
        sa.Column("affiliate_partner", sa.String(length=64)),
        sa.Column("is_connected_priority", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    add_updated_at_trigger("content_availability")

    op.create_table(
        "snips",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id")),
        sa.Column("image_url", sa.String(length=512)),
        sa.Column("match_status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("match_confidence", sa.Numeric(3, 2)),
        sa.Column("capture_source", sa.String(length=32), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    add_updated_at_trigger("snips")

    op.create_table(
        "ratings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id"), nullable=False),
        sa.Column("score", sa.Numeric(3, 1), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "content_title_id", name="uq_rating_user_title"),
    )
    add_updated_at_trigger("ratings")

    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id"), nullable=False),
        sa.Column("rating_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ratings.id")),
        sa.Column("body", sa.Text()),
        sa.Column("emoji_reaction", sa.String(length=32)),
        sa.Column("contains_spoilers", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "content_title_id", name="uq_review_user_title"),
    )
    add_updated_at_trigger("reviews")

    op.create_table(
        "watchlists",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    add_updated_at_trigger("watchlists")

    op.create_table(
        "watchlist_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("watchlist_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("watchlists.id"), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id"), nullable=False),
        sa.Column("added_via", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.String(length=280)),
        sa.Column("position", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("watchlist_id", "content_title_id", name="uq_watchlist_item"),
    )

    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("invite_code", sa.String(length=32), nullable=False, unique=True),
        sa.Column("max_members", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
    )
    add_updated_at_trigger("teams")

    op.create_table(
        "team_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_member"),
    )

    op.create_table(
        "team_activity",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("activity_type", sa.String(length=32), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id")),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id"), nullable=False),
        sa.Column("review_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("reviews.id")),
        sa.Column("target", sa.String(length=32), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id")),
        sa.Column("shared_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "affiliate_clicks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id"), nullable=False),
        sa.Column("provider_code", sa.String(length=64), nullable=False),
        sa.Column("region_code", sa.String(length=2), nullable=False, server_default="US"),
        sa.Column("target_url", sa.String(length=512), nullable=False),
        sa.Column("partner_code", sa.String(length=64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notification_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.String(length=280), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "user_preferences",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("notifications_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("preferred_regions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='["US"]'),
        sa.Column("connected_streaming_services", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("instagram_share_default", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    add_updated_at_trigger("user_preferences")


def downgrade() -> None:
    for table_name in [
        "user_preferences",
        "notifications",
        "affiliate_clicks",
        "shares",
        "team_activity",
        "team_members",
        "teams",
        "watchlist_items",
        "watchlists",
        "reviews",
        "ratings",
        "snips",
        "content_availability",
        "content_titles",
        "devices",
        "user_profiles",
        "auth_identities",
        "users",
    ]:
        op.execute(f"DROP TRIGGER IF EXISTS {table_name}_set_updated_at ON {table_name};")
        op.drop_table(table_name)
    op.execute("DROP FUNCTION IF EXISTS set_updated_at;")
