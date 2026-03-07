from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.dependencies import DbSession
from app.models.content import ContentAvailability, ContentTitle
from app.schemas.content import StreamingOptionResponse, TitleResponse
from app.services.tmdb import (
    TmdbConfigurationError,
    refresh_streaming_options,
    refresh_title_details,
    search_titles as tmdb_search_titles,
)

router = APIRouter()


@router.get("/search", response_model=list[TitleResponse])
def search_titles(q: str, db: DbSession) -> list[TitleResponse]:
    if not q.strip():
        return []
    try:
        titles = tmdb_search_titles(db, q)
    except TmdbConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return [_to_title_response(title) for title in titles]


@router.get("/{title_id}", response_model=TitleResponse)
def get_title(title_id: UUID, db: DbSession) -> TitleResponse:
    title = db.scalar(select(ContentTitle).where(ContentTitle.id == title_id))
    if title is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Title not found")

    try:
        title = refresh_title_details(db, title)
    except TmdbConfigurationError:
        pass
    return _to_title_response(title)


@router.get("/{title_id}/streaming-options", response_model=list[StreamingOptionResponse])
def get_streaming_options(title_id: UUID, db: DbSession) -> list[StreamingOptionResponse]:
    title = db.scalar(select(ContentTitle).where(ContentTitle.id == title_id))
    if title is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Title not found")

    try:
        options = refresh_streaming_options(db, title)
    except TmdbConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return [_to_streaming_response(option) for option in options]


def _to_title_response(title: ContentTitle) -> TitleResponse:
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


def _to_streaming_response(option: ContentAvailability) -> StreamingOptionResponse:
    return StreamingOptionResponse(
        provider_code=option.provider_code,
        provider_name=option.provider_name,
        region_code=option.region_code,
        deeplink_url=option.deeplink_url,
        web_url=option.web_url,
        is_connected_priority=option.is_connected_priority,
    )

