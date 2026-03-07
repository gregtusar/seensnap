from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.content import TitleResponse


class WatchlistItemResponse(BaseModel):
    id: UUID
    content_title_id: UUID
    added_via: str
    created_at: datetime
    title: TitleResponse


class WatchlistResponse(BaseModel):
    id: UUID
    name: str
    items: list[WatchlistItemResponse]


class WatchlistAddRequest(BaseModel):
    content_title_id: UUID
    added_via: str = Field(default="manual", min_length=1, max_length=32)

