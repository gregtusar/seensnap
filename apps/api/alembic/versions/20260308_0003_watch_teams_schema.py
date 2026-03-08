"""watch teams schema

Revision ID: 20260308_0003
Revises: 20260308_0002
Create Date: 2026-03-08 19:10:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260308_0003"
down_revision = "20260308_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("slug", sa.String(length=140), nullable=True))
    op.add_column("teams", sa.Column("description", sa.String(length=280), nullable=True))
    op.add_column("teams", sa.Column("visibility", sa.String(length=16), nullable=False, server_default="private"))
    op.add_column("teams", sa.Column("icon", sa.String(length=16), nullable=True))
    op.add_column("teams", sa.Column("cover_image", sa.String(length=512), nullable=True))
    op.add_column("teams", sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True))

    op.execute("UPDATE teams SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL")
    op.execute("UPDATE teams SET slug = concat(slug, '-', substr(replace(id::text,'-',''),1,6)) WHERE slug IN (SELECT slug FROM teams GROUP BY slug HAVING count(*) > 1)")
    op.alter_column("teams", "slug", nullable=False)
    op.create_unique_constraint("uq_teams_slug", "teams", ["slug"])

    op.create_table(
        "team_titles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id"), nullable=False),
        sa.Column("added_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("note", sa.String(length=280)),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "content_title_id", name="uq_team_title"),
    )
    op.create_index("ix_team_titles_team_added", "team_titles", ["team_id", "added_at"])

    op.create_table(
        "team_rankings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("content_title_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_titles.id"), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(3, 1), nullable=False, server_default="7.0"),
        sa.Column("movement", sa.String(length=8), nullable=False, server_default="same"),
        sa.Column("weeks_on_list", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "content_title_id", name="uq_team_ranking"),
    )
    op.create_index("ix_team_rankings_team_rank", "team_rankings", ["team_id", "rank"])


def downgrade() -> None:
    op.drop_index("ix_team_rankings_team_rank", table_name="team_rankings")
    op.drop_table("team_rankings")

    op.drop_index("ix_team_titles_team_added", table_name="team_titles")
    op.drop_table("team_titles")

    op.drop_constraint("uq_teams_slug", "teams", type_="unique")
    op.drop_column("teams", "last_activity_at")
    op.drop_column("teams", "cover_image")
    op.drop_column("teams", "icon")
    op.drop_column("teams", "visibility")
    op.drop_column("teams", "description")
    op.drop_column("teams", "slug")
