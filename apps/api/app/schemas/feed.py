from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.content import TitleResponse


class FeedActorResponse(BaseModel):
    user_id: UUID
    display_name: str | None = None
    avatar_url: str | None = None


class FeedEventResponse(BaseModel):
    id: UUID
    team_id: UUID | None = None
    event_type: str
    source_type: str
    source_id: UUID | None = None
    actor: FeedActorResponse
    title: TitleResponse | None = None
    payload: dict = Field(default_factory=dict)
    reaction_counts: dict[str, int] = Field(default_factory=dict)
    comment_count: int = 0
    my_reaction: str | None = None
    can_delete: bool = False
    created_at: datetime


class FeedReactionRequest(BaseModel):
    reaction: str = Field(min_length=1, max_length=32)


class FeedCommentCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=280)


class FeedCommentResponse(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    display_name: str | None = None
    avatar_url: str | None = None
    body: str
    parent_comment_id: UUID | None = None
    can_delete: bool = False
    created_at: datetime


class FeedWallPostCreateRequest(BaseModel):
    content_title_id: UUID | None = None
    caption: str | None = None
    rating: float | None = None
    share_to_team_id: UUID | None = None
