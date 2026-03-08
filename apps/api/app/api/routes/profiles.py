from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models.content import ContentTitle
from app.models.social import FeedEvent
from app.models.user import UserProfile
from app.schemas.user import PublicProfilePostResponse, PublicProfileResponse

router = APIRouter()


@router.get("/{user_id}", response_model=PublicProfileResponse)
def get_public_profile(user_id: UUID, current_user: CurrentUser, db: DbSession) -> PublicProfileResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return PublicProfileResponse(
        user_id=profile.user_id,
        username=profile.username,
        display_name=profile.display_name,
        avatar_url=profile.avatar_url,
        bio=profile.bio,
    )


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
            FeedEvent.event_type.in_(["wall_post", "poster_share", "friend_rating", "recommendation"]),
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

