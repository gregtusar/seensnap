from uuid import UUID

from pydantic import BaseModel, Field


class TeamCreateRequest(BaseModel):
    owner_user_id: UUID
    name: str = Field(min_length=1, max_length=120)
    max_members: int = Field(default=5, ge=2, le=5)


class TeamResponse(BaseModel):
    id: UUID
    name: str
    owner_user_id: UUID
    invite_code: str
    max_members: int

