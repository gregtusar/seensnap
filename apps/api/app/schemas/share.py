from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TeamShareCreateRequest(BaseModel):
    content_title_id: UUID


class TeamShareResponse(BaseModel):
    id: UUID
    user_id: UUID
    content_title_id: UUID
    team_id: UUID
    target: str
    shared_at: datetime
