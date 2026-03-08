from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.api.dependencies import CurrentUser, DbSession
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.social import Watchlist
from app.models.user import AuthIdentity, User, UserPreferences, UserProfile
from app.schemas.auth import DevAuthRequest, GoogleAuthRequest, SessionResponse, SessionUserResponse
from app.services.auth import GoogleAuthError, authenticate_with_google

router = APIRouter()


@router.get("/me", response_model=SessionUserResponse, status_code=status.HTTP_200_OK)
def get_session_user(current_user: CurrentUser, db: DbSession) -> SessionUserResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    return SessionUserResponse(
        user_id=current_user.id,
        email=current_user.email,
        display_name=profile.display_name if profile and profile.display_name else current_user.email.split("@", 1)[0],
        avatar_url=profile.avatar_url if profile else None,
    )


@router.post("/google", response_model=SessionResponse, status_code=status.HTTP_200_OK)
def google_auth(payload: GoogleAuthRequest) -> SessionResponse:
    db = SessionLocal()
    try:
        return authenticate_with_google(db, payload.id_token)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    finally:
        db.close()


@router.post("/dev", response_model=SessionResponse, status_code=status.HTTP_200_OK)
def dev_auth(payload: DevAuthRequest) -> SessionResponse:
    db = SessionLocal()
    try:
        email = payload.email.strip().lower() or "dev@seensnap.local"
        display_name = payload.display_name.strip() or "Local Dev"

        user = db.scalar(select(User).where(func.lower(User.email) == email))
        if user is None:
            user = User(email=email, auth_provider="dev")
            db.add(user)
            db.flush()

        profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
        if profile is None:
            profile = UserProfile(
                user_id=user.id,
                username=email.split("@", 1)[0][:32] or "local-dev",
                display_name=display_name,
                avatar_url=None,
                favorite_genres=[],
                country_code="US",
            )
            db.add(profile)

        auth_identity = db.scalar(
            select(AuthIdentity).where(
                AuthIdentity.provider == "dev",
                AuthIdentity.provider_subject == email,
            )
        )
        if auth_identity is None:
            db.add(
                AuthIdentity(
                    user_id=user.id,
                    provider="dev",
                    provider_subject=email,
                    email=email,
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

        return SessionResponse(
            access_token=create_access_token(user.id, user.email, "dev"),
            user=SessionUserResponse(
                user_id=user.id,
                email=user.email,
                display_name=profile.display_name,
                avatar_url=profile.avatar_url,
            ),
        )
    finally:
        db.close()
