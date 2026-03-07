from uuid import UUID

from pydantic import BaseModel


class SnipCreateRequest(BaseModel):
    user_id: UUID
    capture_source: str
    image_url: str | None = None


class SnipCreateResponse(BaseModel):
    id: UUID
    status: str


class SnipMatchRequest(BaseModel):
    selected_title_id: UUID | None = None


class SnipResponse(BaseModel):
    id: UUID
    user_id: UUID
    content_title_id: UUID | None = None
    image_url: str | None = None
    match_status: str
    match_confidence: float | None = None
    capture_source: str

