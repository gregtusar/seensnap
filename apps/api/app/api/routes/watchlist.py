from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from app.api.dependencies import CurrentUser, DbSession
from app.models.content import ContentTitle
from app.models.social import Team, TeamMember, Watchlist, WatchlistItem
from app.schemas.content import TitleResponse
from app.schemas.watchlist import WatchlistAddRequest, WatchlistItemResponse, WatchlistResponse
from app.services.activity import log_team_activity
from app.services.feed import create_feed_event

router = APIRouter()


@router.get("", response_model=WatchlistResponse)
def get_watchlist(current_user: CurrentUser, db: DbSession) -> WatchlistResponse:
    watchlist = _get_or_create_watchlist(db, current_user.id)
    items = db.scalars(
        select(WatchlistItem).where(WatchlistItem.watchlist_id == watchlist.id).order_by(WatchlistItem.created_at.desc())
    ).all()
    titles = {
        title.id: title
        for title in db.scalars(
            select(ContentTitle).where(ContentTitle.id.in_([item.content_title_id for item in items]))
        ).all()
    }
    return WatchlistResponse(
        id=watchlist.id,
        name=watchlist.name,
        items=[
            WatchlistItemResponse(
                id=item.id,
                content_title_id=item.content_title_id,
                added_via=item.added_via,
                created_at=item.created_at,
                title=_title_response(titles[item.content_title_id]),
            )
            for item in items
            if item.content_title_id in titles
        ],
    )


@router.post("/items", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
def add_watchlist_item(
    payload: WatchlistAddRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> WatchlistResponse:
    watchlist = _get_or_create_watchlist(db, current_user.id)
    title = db.scalar(select(ContentTitle).where(ContentTitle.id == payload.content_title_id))
    if title is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Title not found")

    existing = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist.id,
            WatchlistItem.content_title_id == payload.content_title_id,
        )
    )
    if existing is None:
        item = WatchlistItem(
            watchlist_id=watchlist.id,
            content_title_id=payload.content_title_id,
            added_via=payload.added_via,
        )
        db.add(item)
        db.flush()
        team_ids = db.scalars(
            select(TeamMember.team_id)
            .join(Team, Team.id == TeamMember.team_id)
            .where(
                TeamMember.user_id == current_user.id,
                TeamMember.status == "active",
                Team.archived_at.is_(None),
            )
        ).all()
        for team_id in team_ids:
            log_team_activity(
                db,
                team_id=team_id,
                actor_user_id=current_user.id,
                activity_type="watchlist_item_added",
                content_title_id=title.id,
                entity_id=item.id,
                payload={
                    "title_name": title.title,
                    "content_type": title.content_type,
                    "list_name": watchlist.name,
                    "added_via": payload.added_via,
                },
            )
            create_feed_event(
                db,
                actor_user_id=current_user.id,
                team_id=team_id,
                content_title_id=title.id,
                event_type="watchlist_item_added",
                source_type="watchlist_item",
                source_id=item.id,
                payload={
                    "title_name": title.title,
                    "content_type": title.content_type,
                    "list_name": watchlist.name,
                    "added_via": payload.added_via,
                    "cta": "add_to_watchlist",
                },
            )
        db.commit()

    return get_watchlist(current_user, db)


@router.delete("/items/{item_id}", response_model=WatchlistResponse)
def delete_watchlist_item(item_id: UUID, current_user: CurrentUser, db: DbSession) -> WatchlistResponse:
    watchlist = _get_or_create_watchlist(db, current_user.id)
    item = db.scalar(
        select(WatchlistItem).where(WatchlistItem.id == item_id, WatchlistItem.watchlist_id == watchlist.id)
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist item not found")
    db.execute(delete(WatchlistItem).where(WatchlistItem.id == item.id))
    db.commit()
    return get_watchlist(current_user, db)


def _get_or_create_watchlist(db: DbSession, user_id) -> Watchlist:
    watchlist = db.scalar(
        select(Watchlist).where(Watchlist.owner_user_id == user_id, Watchlist.is_default.is_(True))
    )
    if watchlist is None:
        watchlist = Watchlist(owner_user_id=user_id, name="My Picks", is_default=True)
        db.add(watchlist)
        db.commit()
        db.refresh(watchlist)
    return watchlist


def _title_response(title: ContentTitle) -> TitleResponse:
    metadata = title.metadata_raw or {}
    credits = metadata.get("credits", {}) if isinstance(metadata, dict) else {}
    crew = credits.get("crew", []) if isinstance(credits, dict) else []
    cast = credits.get("cast", []) if isinstance(credits, dict) else []
    director = next(
        (
            person.get("name")
            for person in crew
            if isinstance(person, dict) and person.get("job") == "Director" and person.get("name")
        ),
        None,
    )
    top_cast = [
        person.get("name")
        for person in cast
        if isinstance(person, dict) and person.get("name")
    ][:5]
    return TitleResponse(
        id=title.id,
        tmdb_id=title.tmdb_id,
        content_type=title.content_type,
        title=title.title,
        original_title=title.original_title,
        overview=title.overview,
        poster_url=title.poster_url,
        backdrop_url=title.backdrop_url,
        genres=title.genres,
        release_date=title.release_date,
        runtime_minutes=title.runtime_minutes,
        season_count=title.season_count,
        tmdb_rating=float(title.tmdb_vote_average) if title.tmdb_vote_average is not None else None,
        language=metadata.get("original_language") if isinstance(metadata, dict) else None,
        director=director,
        top_cast=top_cast,
    )
