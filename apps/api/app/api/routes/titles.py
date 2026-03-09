from datetime import date
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models.content import ContentAvailability, ContentTitle
from app.models.social import Watchlist, WatchlistItem
from app.schemas.content import RecommendationResponse, StreamingOptionResponse, TitleResponse
from app.services.tmdb import (
    TmdbConfigurationError,
    discover_titles_by_genre,
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


@router.get("/recommendations/for-me", response_model=list[RecommendationResponse])
def get_my_recommendations(
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(default=24, ge=6, le=60),
    preferred_type: str | None = Query(default=None, pattern="^(movie|show)$"),
) -> list[RecommendationResponse]:
    saved_ids = db.scalars(
        select(WatchlistItem.content_title_id)
        .join(Watchlist, Watchlist.id == WatchlistItem.watchlist_id)
        .where(Watchlist.owner_user_id == current_user.id)
    ).all()
    saved_set = set(saved_ids)
    seed_titles = db.scalars(
        select(ContentTitle)
        .where(ContentTitle.id.in_(saved_set))
        .order_by(ContentTitle.release_date.desc())
        .limit(8)
    ).all() if saved_set else []

    ranked: dict[UUID, dict] = {}
    try:
        if seed_titles:
            for seed in seed_titles:
                related = fetch_related_titles(db, seed, limit=12)
                for idx, candidate in enumerate(related):
                    if candidate.id in saved_set:
                        continue
                    weight = max(12 - idx, 1)
                    entry = ranked.setdefault(
                        candidate.id,
                        {"title": candidate, "score": 0, "seed": seed, "occurrences": 0},
                    )
                    entry["score"] += weight
                    entry["occurrences"] += 1

            chosen = sorted(
                ranked.values(),
                key=lambda item: (
                    item["score"],
                    item["occurrences"],
                    float(item["title"].tmdb_vote_average or 0),
                ),
                reverse=True,
            )
            if preferred_type == "movie":
                chosen = [item for item in chosen if item["title"].content_type == "movie"]
            elif preferred_type == "show":
                chosen = [item for item in chosen if item["title"].content_type == "series"]
            chosen = chosen[:limit]
            if chosen:
                return [
                    RecommendationResponse(
                        title=_to_title_response(item["title"]),
                        reason=f"Because you saved {item['seed'].title}",
                        seed_title_id=item["seed"].id,
                    )
                    for item in chosen
                ]
        trending = fetch_trending_titles(db, limit=limit * 2)
        fallback = [title for title in trending if title.id not in saved_set]
        if preferred_type == "movie":
            fallback = [title for title in fallback if title.content_type == "movie"]
        elif preferred_type == "show":
            fallback = [title for title in fallback if title.content_type == "series"]
        fallback = fallback[:limit]
        return [
            RecommendationResponse(
                title=_to_title_response(title),
                reason="Trending right now",
                seed_title_id=None,
            )
            for title in fallback
        ]
    except TmdbConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


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
