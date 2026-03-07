from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.social import Watchlist
from app.models.user import User, UserPreferences, UserProfile

DEMO_EMAIL = "demo@seensnap.app"
DEMO_TOKEN = "expo-go-demo-session"


def ensure_demo_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user is None:
        user = User(email=DEMO_EMAIL, auth_provider="demo")
        db.add(user)
        db.flush()

        db.add(
            UserProfile(
                user_id=user.id,
                username="demo",
                display_name="SeenSnap Demo",
                favorite_genres=[],
                country_code="US",
            )
        )
        db.add(UserPreferences(user_id=user.id))
        db.add(Watchlist(owner_user_id=user.id, name="My Picks", is_default=True))
        db.commit()
        db.refresh(user)
        return user

    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        db.add(
            UserProfile(
                user_id=user.id,
                username="demo",
                display_name="SeenSnap Demo",
                favorite_genres=[],
                country_code="US",
            )
        )
    preferences = db.scalar(select(UserPreferences).where(UserPreferences.user_id == user.id))
    if preferences is None:
        db.add(UserPreferences(user_id=user.id))
    watchlist = db.scalar(
        select(Watchlist).where(Watchlist.owner_user_id == user.id, Watchlist.is_default.is_(True))
    )
    if watchlist is None:
        db.add(Watchlist(owner_user_id=user.id, name="My Picks", is_default=True))
    db.commit()
    db.refresh(user)
    return user

