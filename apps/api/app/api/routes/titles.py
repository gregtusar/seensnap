from datetime import date
from uuid import UUID

import httpx
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
from app.services.wikipedia import resolve_wikipedia_metadata

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
    try:
        wikipedia_metadata = resolve_wikipedia_metadata(
            title=title.title,
            release_date=title.release_date,
            content_type=title.content_type,
        )
    except httpx.HTTPError:
        wikipedia_metadata = None
    return _to_title_response(title, wikipedia_metadata)


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


def _to_title_response(title: ContentTitle, wikipedia_metadata=None) -> TitleResponse:
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

    release_date = title.release_date
    if wikipedia_metadata and wikipedia_metadata.year:
        release_date = release_date or date(wikipedia_metadata.year, 1, 1)

    genres = (
        wikipedia_metadata.genres
        if wikipedia_metadata and wikipedia_metadata.genres
        else title.genres
    )
    overview = (
        wikipedia_metadata.synopsis
        if wikipedia_metadata and wikipedia_metadata.synopsis
        else title.overview
    )
    runtime = (
        wikipedia_metadata.runtime_minutes
        if wikipedia_metadata and wikipedia_metadata.runtime_minutes
        else title.runtime_minutes
    )
    seasons = (
        wikipedia_metadata.seasons
        if wikipedia_metadata and wikipedia_metadata.seasons
        else title.season_count
    )
    episodes = wikipedia_metadata.episodes if wikipedia_metadata and wikipedia_metadata.episodes else None
    director_name = (
        wikipedia_metadata.director or wikipedia_metadata.creator
        if wikipedia_metadata
        else director
    ) or director
    cast_names = (wikipedia_metadata.cast if wikipedia_metadata and wikipedia_metadata.cast else top_cast) or []
    language = (
        wikipedia_metadata.language
        if wikipedia_metadata and wikipedia_metadata.language
        else metadata.get("original_language") if isinstance(metadata, dict) else None
    )
    country = wikipedia_metadata.country if wikipedia_metadata and wikipedia_metadata.country else None
    creator = wikipedia_metadata.creator if wikipedia_metadata and wikipedia_metadata.creator else None
    image_url = (
        wikipedia_metadata.image_url
        if wikipedia_metadata and wikipedia_metadata.image_url
        else title.poster_url
    )
    wikipedia_url = wikipedia_metadata.wikipedia_url if wikipedia_metadata else None
    source_label = "wikipedia" if wikipedia_metadata else "tmdb_fallback"

    return TitleResponse(
        id=title.id,
        tmdb_id=title.tmdb_id,
        content_type=title.content_type,
        title=title.title,
        original_title=title.original_title,
        overview=overview,
        poster_url=image_url,
        backdrop_url=title.backdrop_url,
        genres=genres,
        release_date=release_date,
        runtime_minutes=runtime,
        season_count=seasons,
        episode_count=episodes,
        tmdb_rating=float(title.tmdb_vote_average) if title.tmdb_vote_average is not None else None,
        language=language,
        country=country,
        creator=creator,
        director=director_name,
        top_cast=cast_names,
        wikipedia_url=wikipedia_url,
        metadata_source=source_label,
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
