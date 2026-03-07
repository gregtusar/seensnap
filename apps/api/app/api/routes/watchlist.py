from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from app.api.dependencies import CurrentUser, DbSession
from app.models.content import ContentTitle
from app.models.social import Watchlist, WatchlistItem
from app.schemas.content import TitleResponse
from app.schemas.watchlist import WatchlistAddRequest, WatchlistItemResponse, WatchlistResponse

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
        db.add(
            WatchlistItem(
                watchlist_id=watchlist.id,
                content_title_id=payload.content_title_id,
                added_via=payload.added_via,
            )
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
    )
