from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.dependencies import CurrentUser, DbSession
from app.models.content import ContentTitle
from app.models.social import FeedEvent
from app.models.user import UserProfile
from app.schemas.user import PublicProfilePostResponse, PublicProfileResponse
from app.schemas.taste import CompatibilityResponse, TasteProfileResponse
from app.services.compatibility import get_compatibility, to_compatibility_response
from app.services.follows import follow_user, get_follow_counts, is_following, unfollow_user
from app.services.taste import get_taste_profile, to_taste_profile_response

router = APIRouter()


@router.get("/{user_id}", response_model=PublicProfileResponse)
def get_public_profile(user_id: UUID, current_user: CurrentUser, db: DbSession) -> PublicProfileResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    taste_profile = get_taste_profile(db, profile.user_id)
    follower_count, following_count = get_follow_counts(db, user_id)
    post_count = db.scalar(
        select(func.count(FeedEvent.id)).where(
            FeedEvent.actor_user_id == user_id,
            FeedEvent.team_id.is_(None),
        )
    ) or 0
    compatibility = (
        to_compatibility_response(get_compatibility(db, current_user.id, profile.user_id), current_user.id, profile.user_id)
        if current_user.id != profile.user_id
        else None
    )
    return PublicProfileResponse(
        user_id=profile.user_id,
        username=profile.username,
        display_name=profile.display_name,
        avatar_url=profile.avatar_url,
        bio=profile.bio,
        follower_count=follower_count,
        following_count=following_count,
        post_count=int(post_count),
        is_following=is_following(db, current_user.id, profile.user_id) if current_user.id != profile.user_id else False,
        can_follow=current_user.id != profile.user_id,
        taste_labels=taste_profile.taste_labels or [],
        favorite_genres=taste_profile.top_genres or [],
        favorite_platforms=taste_profile.top_platforms or [],
        profile_summary=taste_profile.profile_summary,
        current_obsessions=taste_profile.current_obsessions or [],
        top_posters=taste_profile.top_posters or [],
        compatibility=compatibility,
    )


@router.get("/{user_id}/taste", response_model=TasteProfileResponse)
def get_public_taste_profile(user_id: UUID, current_user: CurrentUser, db: DbSession) -> TasteProfileResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return to_taste_profile_response(get_taste_profile(db, profile.user_id, force_refresh=True))


@router.get("/{user_id}/compatibility", response_model=CompatibilityResponse)
def get_profile_compatibility(user_id: UUID, current_user: CurrentUser, db: DbSession) -> CompatibilityResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return to_compatibility_response(get_compatibility(db, current_user.id, profile.user_id, force_refresh=True), current_user.id, profile.user_id)


@router.get("/{user_id}/posts", response_model=list[PublicProfilePostResponse])
def get_public_profile_posts(
    user_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(default=50, ge=1, le=100),
) -> list[PublicProfilePostResponse]:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    events = db.scalars(
        select(FeedEvent)
        .where(
            FeedEvent.actor_user_id == user_id,
            FeedEvent.team_id.is_(None),
        )
        .order_by(FeedEvent.created_at.desc())
        .limit(limit)
    ).all()
    if not events:
        return []

    title_ids = {event.content_title_id for event in events if event.content_title_id is not None}
    titles = (
        {
            title.id: title
            for title in db.scalars(select(ContentTitle).where(ContentTitle.id.in_(title_ids))).all()
        }
        if title_ids
        else {}
    )

    return [
        PublicProfilePostResponse(
            id=event.id,
            author_id=event.actor_user_id,
            author_display_name=profile.display_name,
            author_avatar_url=profile.avatar_url,
            title_id=event.content_title_id,
            title_name=titles[event.content_title_id].title if event.content_title_id in titles else None,
            title_poster_url=titles[event.content_title_id].poster_url if event.content_title_id in titles else None,
            caption=(
                event.payload.get("caption")
                if isinstance(event.payload, dict) and isinstance(event.payload.get("caption"), str)
                else event.payload.get("body")
                if isinstance(event.payload, dict) and isinstance(event.payload.get("body"), str)
                else None
            ),
            rating=float(event.payload.get("rating")) if isinstance(event.payload, dict) and isinstance(event.payload.get("rating"), (int, float)) else None,
            created_at=event.created_at,
        )
        for event in events
    ]


@router.post("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def follow_profile(user_id: UUID, current_user: CurrentUser, db: DbSession) -> None:
    follow_user(db, follower_user_id=current_user.id, following_user_id=user_id)
    return None


@router.delete("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_profile(user_id: UUID, current_user: CurrentUser, db: DbSession) -> None:
    unfollow_user(db, follower_user_id=current_user.id, following_user_id=user_id)
    return None
