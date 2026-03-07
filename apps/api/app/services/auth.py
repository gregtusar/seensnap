from __future__ import annotations

import re
from dataclasses import dataclass

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.models.social import Watchlist
from app.models.user import AuthIdentity, User, UserPreferences, UserProfile
from app.schemas.auth import SessionResponse, SessionUserResponse


class GoogleAuthError(Exception):
    pass


@dataclass
class GoogleIdentity:
    subject: str
    email: str
    display_name: str
    avatar_url: str | None


def verify_google_identity_token(token: str) -> GoogleIdentity:
    if not settings.google_oauth_client_id:
        raise GoogleAuthError("GOOGLE_OAUTH_CLIENT_ID is not configured")

    try:
        payload = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.google_oauth_client_id,
        )
    except Exception as exc:  # noqa: BLE001
        raise GoogleAuthError("Google ID token verification failed") from exc

    if not payload.get("email_verified"):
        raise GoogleAuthError("Google account email is not verified")

    return GoogleIdentity(
        subject=payload["sub"],
        email=payload["email"].lower(),
        display_name=payload.get("name") or payload["email"].split("@", 1)[0],
        avatar_url=payload.get("picture"),
    )


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:32] or "seensnap-user"


def _build_unique_username(db: Session, base_value: str) -> str:
    base_slug = _slugify(base_value)
    existing = {
        row
        for row in db.scalars(
            select(UserProfile.username).where(UserProfile.username.like(f"{base_slug}%"))
        )
    }
    if base_slug not in existing:
        return base_slug

    suffix = 2
    while f"{base_slug}-{suffix}" in existing:
        suffix += 1
    return f"{base_slug}-{suffix}"


def authenticate_with_google(db: Session, token: str) -> SessionResponse:
    identity = verify_google_identity_token(token)

    auth_identity = db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "google",
            AuthIdentity.provider_subject == identity.subject,
        )
    )

    if auth_identity is not None:
        user = db.scalar(select(User).where(User.id == auth_identity.user_id))
        profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    else:
        user = db.scalar(select(User).where(func.lower(User.email) == identity.email))
        if user is None:
            user = User(email=identity.email, auth_provider="google")
            db.add(user)
            db.flush()

            profile = UserProfile(
                user_id=user.id,
                username=_build_unique_username(db, identity.email.split("@", 1)[0]),
                display_name=identity.display_name,
                avatar_url=identity.avatar_url,
                favorite_genres=[],
                country_code="US",
            )
            db.add(profile)
            db.add(UserPreferences(user_id=user.id))
            db.add(Watchlist(owner_user_id=user.id, name="My Picks", is_default=True))
        else:
            profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))

        db.add(
            AuthIdentity(
                user_id=user.id,
                provider="google",
                provider_subject=identity.subject,
                email=identity.email,
            )
        )

    if profile is None:
        profile = UserProfile(
            user_id=user.id,
            username=_build_unique_username(db, identity.email.split("@", 1)[0]),
            display_name=identity.display_name,
            avatar_url=identity.avatar_url,
            favorite_genres=[],
            country_code="US",
        )
        db.add(profile)

    db.commit()

    access_token = create_access_token(user.id, user.email, "google")
    return SessionResponse(
        access_token=access_token,
        user=SessionUserResponse(
            user_id=user.id,
            email=user.email,
            display_name=profile.display_name,
            avatar_url=profile.avatar_url,
        ),
    )
