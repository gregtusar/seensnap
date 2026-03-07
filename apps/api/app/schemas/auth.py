from uuid import UUID

from pydantic import BaseModel


class GoogleAuthRequest(BaseModel):
    id_token: str


class SessionUserResponse(BaseModel):
    user_id: UUID
    email: str
    display_name: str
    avatar_url: str | None = None


class SessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: SessionUserResponse

