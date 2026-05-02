import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserTasteProfile(Base):
    __tablename__ = "user_taste_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    top_genres: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    top_themes: Mapped[list[str]] = mapped_column(JSONB, default=list)
    top_platforms: Mapped[list[str]] = mapped_column(JSONB, default=list)
    favorite_eras: Mapped[list[str]] = mapped_column(JSONB, default=list)
    taste_labels: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    profile_summary: Mapped[str | None] = mapped_column(String(512))
    current_obsessions: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    top_posters: Mapped[list[str]] = mapped_column(JSONB, default=list)
    most_saved_genre: Mapped[str | None] = mapped_column(String(120))
    signal_counts: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CompatibilityScore(Base):
    __tablename__ = "compatibility_scores"
    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_compatibility_pair"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_a_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    user_b_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    compatibility: Mapped[int] = mapped_column(Integer)
    shared_genres: Mapped[list[str]] = mapped_column(JSONB, default=list)
    shared_titles: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    shared_labels: Mapped[list[str]] = mapped_column(JSONB, default=list)
    shared_platforms: Mapped[list[str]] = mapped_column(JSONB, default=list)
    summary: Mapped[str | None] = mapped_column(String(280))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TeamAnalyticsSnapshot(Base):
    __tablename__ = "team_analytics"

    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), primary_key=True)
    member_ids: Mapped[list[str]] = mapped_column(JSONB, default=list)
    average_compatibility: Mapped[int] = mapped_column(Integer, default=0)
    most_aligned_pair: Mapped[dict] = mapped_column(JSONB, default=dict)
    most_divisive_member: Mapped[dict] = mapped_column(JSONB, default=dict)
    taste_mvp: Mapped[dict] = mapped_column(JSONB, default=dict)
    most_loved_title: Mapped[dict] = mapped_column(JSONB, default=dict)
    most_divisive_title: Mapped[dict] = mapped_column(JSONB, default=dict)
    genre_breakdown: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    activity_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RecommendationSignal(Base):
    __tablename__ = "recommendation_signals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    content_title_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_titles.id"))
    signal_type: Mapped[str] = mapped_column(String(32))
    weight: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str | None] = mapped_column(String(280))
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SwipeRecord(Base):
    __tablename__ = "swipe_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    content_title_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_titles.id"))
    direction: Mapped[str] = mapped_column(String(12))
    pause_ms: Mapped[int | None] = mapped_column(Integer)
    session_id: Mapped[str | None] = mapped_column(String(80))
    reason: Mapped[str | None] = mapped_column(String(280))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WrappedStat(Base):
    __tablename__ = "wrapped_stats"
    __table_args__ = (
        UniqueConstraint("user_id", "year", name="uq_wrapped_user_year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    year: Mapped[int] = mapped_column(Integer)
    top_genre: Mapped[str | None] = mapped_column(String(120))
    most_saved_title: Mapped[str | None] = mapped_column(String(255))
    favorite_platform: Mapped[str | None] = mapped_column(String(120))
    titles_saved: Mapped[int] = mapped_column(Integer, default=0)
    reactions_count: Mapped[int] = mapped_column(Integer, default=0)
    top_label: Mapped[str | None] = mapped_column(String(120))
    stats: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
