import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (UniqueConstraint("user_id", "content_title_id", name="uq_rating_user_title"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    content_title_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_titles.id"))
    score: Mapped[float] = mapped_column(Numeric(3, 1))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("user_id", "content_title_id", name="uq_review_user_title"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    content_title_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_titles.id"))
    rating_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("ratings.id"))
    body: Mapped[str | None] = mapped_column(Text)
    emoji_reaction: Mapped[str | None] = mapped_column(String(32))
    contains_spoilers: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(String(280))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_system_list: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    __table_args__ = (UniqueConstraint("watchlist_id", "content_title_id", name="uq_watchlist_item"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    watchlist_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("watchlists.id"))
    content_title_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_titles.id"))
    added_via: Mapped[str] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(String(280))
    position: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    description: Mapped[str | None] = mapped_column(String(280))
    visibility: Mapped[str] = mapped_column(String(16), default="private")
    icon: Mapped[str | None] = mapped_column(String(16))
    cover_image: Mapped[str | None] = mapped_column(String(512))
    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    invite_code: Mapped[str] = mapped_column(String(32), unique=True)
    max_members: Mapped[int] = mapped_column(Integer, default=5)
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_member"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="active")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TeamActivity(Base):
    __tablename__ = "team_activity"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"))
    actor_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    activity_type: Mapped[str] = mapped_column(String(32))
    content_title_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("content_titles.id"))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TeamTitle(Base):
    __tablename__ = "team_titles"
    __table_args__ = (UniqueConstraint("team_id", "content_title_id", name="uq_team_title"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"))
    content_title_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_titles.id"))
    added_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(String(280))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TeamRanking(Base):
    __tablename__ = "team_rankings"
    __table_args__ = (UniqueConstraint("team_id", "content_title_id", name="uq_team_ranking"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"))
    content_title_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_titles.id"))
    rank: Mapped[int] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Numeric(3, 1), default=7.0)
    movement: Mapped[str] = mapped_column(String(8), default="same")
    weeks_on_list: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FeedEvent(Base):
    __tablename__ = "feed_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    team_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("teams.id"))
    content_title_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("content_titles.id"))
    event_type: Mapped[str] = mapped_column(String(32))
    source_type: Mapped[str] = mapped_column(String(32))
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FeedReaction(Base):
    __tablename__ = "feed_reactions"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_feed_reaction_event_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("feed_events.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reaction: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FeedComment(Base):
    __tablename__ = "feed_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("feed_events.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    parent_comment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("feed_comments.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Share(Base):
    __tablename__ = "shares"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    content_title_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_titles.id"))
    review_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("reviews.id"))
    target: Mapped[str] = mapped_column(String(32))
    team_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("teams.id"))
    shared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AffiliateClick(Base):
    __tablename__ = "affiliate_clicks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    content_title_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_titles.id"))
    provider_code: Mapped[str] = mapped_column(String(64))
    region_code: Mapped[str] = mapped_column(String(2), default="US")
    target_url: Mapped[str] = mapped_column(String(512))
    partner_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    notification_type: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(String(280))
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
