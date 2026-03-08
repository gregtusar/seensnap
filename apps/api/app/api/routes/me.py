from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.api.dependencies import CurrentUser, DbSession
from app.models.user import UserPreferences, UserProfile
from app.schemas.user import PreferencesResponse, ProfileResponse, ProfileUpdateRequest

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
            bio=None,
        )
    return ProfileResponse(
        user_id=current_user.id,
        email=current_user.email,
        username=profile.username,
        display_name=profile.display_name,
        favorite_genres=profile.favorite_genres,
        country_code=profile.country_code,
        avatar_url=profile.avatar_url,
        bio=profile.bio,
    )


@router.patch("", response_model=ProfileResponse)
def patch_me(payload: ProfileUpdateRequest, current_user: CurrentUser, db: DbSession) -> ProfileResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    if profile is None:
        profile = UserProfile(
            user_id=current_user.id,
            username=current_user.email.split("@", 1)[0][:32] or "seensnap_user",
            display_name=current_user.email.split("@", 1)[0],
            avatar_url=None,
            favorite_genres=[],
            bio=None,
            country_code="US",
        )
        db.add(profile)
        db.flush()

    if payload.username is not None:
        candidate = payload.username.strip().lower()
        if len(candidate) < 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username must be at least 3 characters")
        duplicate = db.scalar(
            select(UserProfile).where(func.lower(UserProfile.username) == candidate, UserProfile.user_id != current_user.id)
        )
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken")
        profile.username = candidate

    if payload.display_name is not None:
        display_name = payload.display_name.strip()
        if not display_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Display name cannot be empty")
        profile.display_name = display_name

    if payload.bio is not None:
        profile.bio = payload.bio.strip() if payload.bio.strip() else None

    if payload.avatar_url is not None:
        avatar = payload.avatar_url.strip()
        profile.avatar_url = avatar if avatar else None

    db.commit()
    db.refresh(profile)
    return ProfileResponse(
        user_id=current_user.id,
        email=current_user.email,
        username=profile.username,
        display_name=profile.display_name,
        favorite_genres=profile.favorite_genres,
        country_code=profile.country_code,
        avatar_url=profile.avatar_url,
        bio=profile.bio,
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
