from uuid import UUID

from pydantic import BaseModel


class ProfileResponse(BaseModel):
    user_id: UUID
    email: str
    username: str
    display_name: str
    favorite_genres: list[str]
    country_code: str
    avatar_url: str | None = None


class PreferencesResponse(BaseModel):
    notifications_enabled: bool
    preferred_regions: list[str]
    connected_streaming_services: list[str]
    instagram_share_default: bool
