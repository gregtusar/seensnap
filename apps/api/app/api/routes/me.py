from fastapi import APIRouter
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models.user import UserPreferences, UserProfile
from app.schemas.user import ProfileResponse, PreferencesResponse

router = APIRouter()


@router.get("", response_model=ProfileResponse)
def get_me(current_user: CurrentUser, db: DbSession) -> ProfileResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    if profile is None:
        return ProfileResponse(
            user_id=current_user.id,
            email=current_user.email,
            username="pending",
            display_name="SeenSnap User",
            favorite_genres=[],
            country_code="US",
            avatar_url=None,
        )
    return ProfileResponse(
        user_id=current_user.id,
        email=current_user.email,
        username=profile.username,
        display_name=profile.display_name,
        favorite_genres=profile.favorite_genres,
        country_code=profile.country_code,
        avatar_url=profile.avatar_url,
    )


@router.get("/preferences", response_model=PreferencesResponse)
def get_preferences(current_user: CurrentUser, db: DbSession) -> PreferencesResponse:
    preferences = db.scalar(select(UserPreferences).where(UserPreferences.user_id == current_user.id))
    if preferences is None:
        return PreferencesResponse(
            notifications_enabled=True,
            preferred_regions=["US"],
            connected_streaming_services=[],
            instagram_share_default=True,
        )
    return PreferencesResponse(
        notifications_enabled=preferences.notifications_enabled,
        preferred_regions=preferences.preferred_regions,
        connected_streaming_services=preferences.connected_streaming_services,
        instagram_share_default=preferences.instagram_share_default,
    )
