from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class TitleResponse(BaseModel):
    id: UUID
    tmdb_id: int
    content_type: str
    title: str
    original_title: str | None = None
    overview: str | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    genres: list[str] = Field(default_factory=list)
    release_date: date | None = None
    runtime_minutes: int | None = None
    season_count: int | None = None


class StreamingOptionResponse(BaseModel):
    provider_code: str
    provider_name: str
    region_code: str
    deeplink_url: str | None = None
    web_url: str | None = None
    is_connected_priority: bool
