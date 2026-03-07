from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TeamCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    max_members: int = Field(default=5, ge=2, le=5)


class TeamJoinRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=32)


class TeamMemberSummaryResponse(BaseModel):
    user_id: UUID
    display_name: str | None = None
    avatar_url: str | None = None
    role: str
    status: str
    joined_at: datetime


class TeamSummaryResponse(BaseModel):
    id: UUID
    name: str
    owner_user_id: UUID
    invite_code: str
    max_members: int
    member_count: int


class TeamResponse(TeamSummaryResponse):
    members: list[TeamMemberSummaryResponse]


class TeamActivityResponse(BaseModel):
    id: UUID
    activity_type: str
    actor_user_id: UUID
    actor_display_name: str | None = None
    actor_avatar_url: str | None = None
    content_title_id: UUID | None = None
    entity_id: UUID | None = None
    payload: dict = Field(default_factory=dict)
    created_at: datetime
