from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from sqlalchemy import func, select

from app.api.dependencies import CurrentUser, DbSession
from app.core.config import settings
from app.models.user import UserPreferences, UserProfile
from app.schemas.user import (
    PreferencesResponse,
    PreferencesUpdateRequest,
    ProfileResponse,
    ProfileUpdateRequest,
)

SUPPORTED_STREAMING_SERVICES = {
    "netflix",
    "prime_video",
    "apple_tv_plus",
    "hbo_max",
    "disney_plus",
    "hulu",
    "paramount_plus",
    "peacock",
}

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
    profile = _ensure_profile(db, current_user.id, current_user.email)

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


@router.post("/avatar", response_model=ProfileResponse)
def upload_avatar(
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> ProfileResponse:
    profile = _ensure_profile(db, current_user.id, current_user.email)
    content_type = (file.content_type or "").lower()
    extension_map = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    ext = extension_map.get(content_type)
    if ext is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image type")

    data = file.file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image file is empty")
    if len(data) > 6 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image too large (max 6MB)")

    avatars_dir = settings.uploads_path() / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user.id}_{uuid4().hex}{ext}"
    target = avatars_dir / filename
    target.write_bytes(data)

    if profile.avatar_url and "/uploads/avatars/" in profile.avatar_url:
        old_name = profile.avatar_url.split("/uploads/avatars/")[-1]
        old_path = avatars_dir / old_name
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    profile.avatar_url = str(request.base_url).rstrip("/") + f"/uploads/avatars/{filename}"
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


@router.delete("/avatar", response_model=ProfileResponse)
def delete_avatar(current_user: CurrentUser, db: DbSession) -> ProfileResponse:
    profile = _ensure_profile(db, current_user.id, current_user.email)
    if profile.avatar_url and "/uploads/avatars/" in profile.avatar_url:
        avatars_dir = settings.uploads_path() / "avatars"
        old_name = profile.avatar_url.split("/uploads/avatars/")[-1]
        old_path = avatars_dir / old_name
        if old_path.exists():
            old_path.unlink(missing_ok=True)
    profile.avatar_url = None
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


@router.patch("/preferences", response_model=PreferencesResponse)
def patch_preferences(
    payload: PreferencesUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> PreferencesResponse:
    preferences = db.scalar(select(UserPreferences).where(UserPreferences.user_id == current_user.id))
    if preferences is None:
        preferences = UserPreferences(user_id=current_user.id)
        db.add(preferences)
        db.flush()

    if payload.connected_streaming_services is not None:
        normalized: list[str] = []
        seen: set[str] = set()
        for service in payload.connected_streaming_services:
            key = service.strip().lower()
            if not key or key in seen:
                continue
            if key not in SUPPORTED_STREAMING_SERVICES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported streaming service: {service}",
                )
            normalized.append(key)
            seen.add(key)
        preferences.connected_streaming_services = normalized

    db.commit()
    db.refresh(preferences)
    return PreferencesResponse(
        notifications_enabled=preferences.notifications_enabled,
        preferred_regions=preferences.preferred_regions,
        connected_streaming_services=preferences.connected_streaming_services,
        instagram_share_default=preferences.instagram_share_default,
    )


def _ensure_profile(db: DbSession, user_id, email: str) -> UserProfile:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is not None:
        return profile
    profile = UserProfile(
        user_id=user_id,
        username=email.split("@", 1)[0][:32] or "seensnap_user",
        display_name=email.split("@", 1)[0],
        avatar_url=None,
        favorite_genres=[],
        bio=None,
        country_code="US",
    )
    db.add(profile)
    db.flush()
    return profile
