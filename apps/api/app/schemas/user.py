from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileResponse(BaseModel):
    user_id: UUID
    email: str
    username: str
    display_name: str
    favorite_genres: list[str]
    country_code: str
    avatar_url: str | None = None
    bio: str | None = None


class PreferencesResponse(BaseModel):
    notifications_enabled: bool
    preferred_regions: list[str]
    connected_streaming_services: list[str]
    instagram_share_default: bool


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    username: str | None = Field(default=None, min_length=3, max_length=40)
    bio: str | None = Field(default=None, max_length=280)
    avatar_url: str | None = Field(default=None, max_length=4096)


class PublicProfileResponse(BaseModel):
    user_id: UUID
    username: str
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None


class PublicProfilePostResponse(BaseModel):
    id: UUID
    author_id: UUID
    author_display_name: str | None = None
    author_avatar_url: str | None = None
    title_id: UUID | None = None
    title_name: str | None = None
    title_poster_url: str | None = None
    caption: str | None = None
    rating: float | None = None
    created_at: datetime
