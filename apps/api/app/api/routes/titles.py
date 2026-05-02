from datetime import date
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models.content import ContentAvailability, ContentTitle
from app.models.social import Watchlist, WatchlistItem
from app.schemas.content import (
    RecommendationResponse,
    RelatedTitleResponse,
    StreamingAvailabilityResponse,
    StreamingOptionResponse,
    TitleImageResponse,
    TitlePersonResponse,
    TitleResponse,
)
from app.schemas.taste import SwipeRecordCreate, SwipeRecordResponse
from app.services.taste import get_social_recommendations, record_swipe
from app.services.tmdb import (
    TmdbConfigurationError,
    discover_titles_by_genre,
    fetch_title_gallery,
    list_tmdb_genres,
    fetch_related_titles,
    fetch_trending_titles,
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


@router.get("/genres", response_model=list[str])
def get_genres() -> list[str]:
    try:
        return list_tmdb_genres()
    except TmdbConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/discover", response_model=list[TitleResponse])
def discover_titles(
    genre: str,
    db: DbSession,
    media_type: str = Query(default="all", pattern="^(all|movie|show)$"),
    limit: int = Query(default=30, ge=6, le=60),
) -> list[TitleResponse]:
    try:
        titles = discover_titles_by_genre(db, genre=genre, media_type=media_type, limit=limit)
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
    try:
        refresh_streaming_options(db, title)
    except TmdbConfigurationError:
        pass
    try:
        gallery = fetch_title_gallery(title, limit=14)
    except TmdbConfigurationError:
        gallery = []
    try:
        related_titles = fetch_related_titles(db, title, limit=10)
    except TmdbConfigurationError:
        related_titles = []
    availability = db.scalars(
        select(ContentAvailability)
        .where(ContentAvailability.content_title_id == title.id)
        .order_by(ContentAvailability.provider_name.asc())
    ).all()
    return _to_title_response(title, wikipedia_metadata, availability, gallery, related_titles)


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


@router.get("/recommendations/for-me", response_model=list[RecommendationResponse])
def get_my_recommendations(
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(default=24, ge=6, le=60),
    preferred_type: str | None = Query(default=None, pattern="^(movie|show)$"),
) -> list[RecommendationResponse]:
    ranked: dict[UUID, dict] = {}
    try:
        return get_social_recommendations(
            db,
            current_user.id,
            limit=limit,
            preferred_type=preferred_type,
        )
    except TmdbConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/swipes", response_model=SwipeRecordResponse)
def record_title_swipe(
    payload: SwipeRecordCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> SwipeRecordResponse:
    title = db.scalar(select(ContentTitle).where(ContentTitle.id == payload.title_id))
    if title is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Title not found")
    try:
        record = record_swipe(
            db,
            current_user.id,
            title_id=payload.title_id,
            direction=payload.direction,
            pause_ms=payload.pause_ms,
            session_id=payload.session_id,
            reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return SwipeRecordResponse(
        title_id=payload.title_id,
        direction=payload.direction,
        updated_at=record.created_at,
    )


def _to_title_response(
    title: ContentTitle,
    wikipedia_metadata=None,
    availability: list[ContentAvailability] | None = None,
    gallery: list[dict] | None = None,
    related_titles: list[ContentTitle] | None = None,
) -> TitleResponse:
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
    cast_people = [
        TitlePersonResponse(
            name=person.get("name") or "Unknown",
            role=person.get("character") or "Actor",
            headshot_url=f"https://image.tmdb.org/t/p/w185{person['profile_path']}"
            if person.get("profile_path")
            else None,
        )
        for person in cast
        if isinstance(person, dict) and person.get("name")
    ][:5]
    creators_people = []
    creator_roles = ["Creator", "Director", "Writer", "Screenplay", "Executive Producer"]
    seen_creator_keys: set[tuple[str, str]] = set()
    for person in crew:
        if not isinstance(person, dict):
            continue
        role = person.get("job")
        name = person.get("name")
        if role not in creator_roles or not name:
            continue
        key = (str(name), str(role))
        if key in seen_creator_keys:
            continue
        seen_creator_keys.add(key)
        creators_people.append(
            TitlePersonResponse(
                name=str(name),
                role=str(role),
                headshot_url=f"https://image.tmdb.org/t/p/w185{person['profile_path']}"
                if person.get("profile_path")
                else None,
            )
        )
        if len(creators_people) >= 3:
            break

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
        streaming_availability=[
            StreamingAvailabilityResponse(
                service=option.provider_code,
                service_name=option.provider_name,
                app_url=option.deeplink_url,
                web_url=option.web_url,
            )
            for option in (availability or [])
            if option.deeplink_url or option.web_url
        ],
        image_gallery=[
            TitleImageResponse(
                url=str(image.get("url")),
                kind=str(image.get("kind") or "backdrop"),
                width=image.get("width") if isinstance(image.get("width"), int) else None,
                height=image.get("height") if isinstance(image.get("height"), int) else None,
            )
            for image in (
                gallery
                or [
                    {"url": title.backdrop_url, "kind": "backdrop"},
                    {"url": image_url, "kind": "poster"},
                ]
            )
            if image.get("url")
        ],
        cast=cast_people or [TitlePersonResponse(name=name, role="Actor", headshot_url=None) for name in cast_names[:5]],
        creators=creators_people
        or ([TitlePersonResponse(name=director_name, role="Director", headshot_url=None)] if director_name else []),
        related_titles=[
            RelatedTitleResponse(
                id=related.id,
                title=related.title,
                content_type=related.content_type,
                poster_url=related.poster_url,
                release_date=related.release_date,
            )
            for related in (related_titles or [])
            if related.id != title.id
        ],
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
