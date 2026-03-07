from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.content import ContentTitle
from app.models.social import Share, Watchlist, WatchlistItem
from app.models.user import User
from app.services.activity import log_team_activity
from app.services.teams import require_team_member


def share_title_to_team(db: Session, current_user: User, team_id, content_title_id) -> Share:
    require_team_member(db, team_id, current_user.id)

    title = db.scalar(select(ContentTitle).where(ContentTitle.id == content_title_id))
    if title is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Title not found")

    watchlist = db.scalar(
        select(Watchlist).where(Watchlist.owner_user_id == current_user.id, Watchlist.is_default.is_(True))
    )
    if watchlist is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No default watchlist found")

    watchlist_item = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist.id,
            WatchlistItem.content_title_id == content_title_id,
        )
    )
    if watchlist_item is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only share titles from your watchlist",
        )

    share = Share(
        user_id=current_user.id,
        content_title_id=content_title_id,
        target="team",
        team_id=team_id,
    )
    db.add(share)
    db.flush()

    log_team_activity(
        db,
        team_id=team_id,
        actor_user_id=current_user.id,
        activity_type="title_shared",
        content_title_id=content_title_id,
        entity_id=share.id,
        payload={"title_name": title.title, "content_type": title.content_type},
    )
    db.commit()
    db.refresh(share)
    return share
