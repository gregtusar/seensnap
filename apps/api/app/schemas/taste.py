from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TasteGenreScoreResponse(BaseModel):
    genre: str
    score: int


class TasteLabelResponse(BaseModel):
    label: str
    confidence: int


class TasteTitleReferenceResponse(BaseModel):
    title_id: UUID | None = None
    title_name: str
    poster_url: str | None = None


class TasteProfileResponse(BaseModel):
    user_id: UUID
    top_genres: list[TasteGenreScoreResponse] = Field(default_factory=list)
    top_themes: list[str] = Field(default_factory=list)
    top_platforms: list[str] = Field(default_factory=list)
    favorite_eras: list[str] = Field(default_factory=list)
    taste_labels: list[TasteLabelResponse] = Field(default_factory=list)
    profile_summary: str | None = None
    current_obsessions: list[TasteTitleReferenceResponse] = Field(default_factory=list)
    top_posters: list[str] = Field(default_factory=list)
    most_saved_genre: str | None = None
    updated_at: datetime | None = None


class CompatibilityResponse(BaseModel):
    user_a: UUID
    user_b: UUID
    compatibility: int
    top_shared_genres: list[str] = Field(default_factory=list)
    top_shared_titles: list[TasteTitleReferenceResponse] = Field(default_factory=list)
    shared_labels: list[str] = Field(default_factory=list)
    shared_platforms: list[str] = Field(default_factory=list)
    summary: str | None = None
    updated_at: datetime | None = None


class TeamAnalyticsPersonResponse(BaseModel):
    user_id: UUID
    display_name: str | None = None
    avatar_url: str | None = None
    score: int | None = None
    detail: str | None = None


class TeamAnalyticsPairResponse(BaseModel):
    members: list[TeamAnalyticsPersonResponse] = Field(default_factory=list)
    compatibility: int = 0
    summary: str | None = None


class TeamAnalyticsGenreBreakdownResponse(BaseModel):
    genre: str
    percent: int


class TeamAnalyticsResponse(BaseModel):
    team_id: UUID
    average_compatibility: int = 0
    most_aligned_members: TeamAnalyticsPairResponse
    most_divisive_member: TeamAnalyticsPersonResponse | None = None
    taste_mvp: TeamAnalyticsPersonResponse | None = None
    most_loved_title: TasteTitleReferenceResponse | None = None
    most_divisive_title: TasteTitleReferenceResponse | None = None
    genre_breakdown: list[TeamAnalyticsGenreBreakdownResponse] = Field(default_factory=list)
    activity_snapshot: dict = Field(default_factory=dict)
    updated_at: datetime | None = None


class SwipeRecordCreate(BaseModel):
    title_id: UUID
    direction: str = Field(pattern="^(left|right|up)$")
    pause_ms: int | None = Field(default=None, ge=0, le=120000)
    session_id: str | None = Field(default=None, max_length=80)
    reason: str | None = Field(default=None, max_length=280)


class SwipeRecordResponse(BaseModel):
    ok: bool = True
    title_id: UUID
    direction: str
    updated_at: datetime | None = None
