from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from pydantic import BaseModel

from app.core.config import settings


class AccessTokenPayload(BaseModel):
    sub: UUID
    email: str
    provider: str
    aud: str
    exp: int
    iat: int


def create_access_token(user_id: UUID, email: str, provider: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "email": email,
        "provider": provider,
        "aud": settings.app_auth_audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=7)).timestamp()),
    }
    return jwt.encode(payload, settings.app_auth_secret, algorithm="HS256")


def decode_access_token(token: str) -> AccessTokenPayload:
    payload = jwt.decode(
        token,
        settings.app_auth_secret,
        algorithms=["HS256"],
        audience=settings.app_auth_audience,
    )
    return AccessTokenPayload.model_validate(payload)

