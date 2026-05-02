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
    episode_count: int | None = None
    tmdb_rating: float | None = None
    language: str | None = None
    country: str | None = None
    creator: str | None = None
    director: str | None = None
    top_cast: list[str] = Field(default_factory=list)
    wikipedia_url: str | None = None
    metadata_source: str = "tmdb_fallback"
    streaming_availability: list["StreamingAvailabilityResponse"] = Field(default_factory=list)
    image_gallery: list["TitleImageResponse"] = Field(default_factory=list)
    cast: list["TitlePersonResponse"] = Field(default_factory=list)
    creators: list["TitlePersonResponse"] = Field(default_factory=list)
    related_titles: list["RelatedTitleResponse"] = Field(default_factory=list)


class StreamingOptionResponse(BaseModel):
    provider_code: str
    provider_name: str
    region_code: str
    deeplink_url: str | None = None
    web_url: str | None = None
    is_connected_priority: bool


class StreamingAvailabilityResponse(BaseModel):
    service: str
    service_name: str
    app_url: str | None = None
    web_url: str | None = None


class TitleImageResponse(BaseModel):
    url: str
    kind: str
    width: int | None = None
    height: int | None = None


class TitlePersonResponse(BaseModel):
    name: str
    role: str
    headshot_url: str | None = None


class RelatedTitleResponse(BaseModel):
    id: UUID
    title: str
    content_type: str
    poster_url: str | None = None
    release_date: date | None = None


class RecommendationResponse(BaseModel):
    title: TitleResponse
    reason: str
    seed_title_id: UUID | None = None
