from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.content import ContentAvailability, ContentTitle

TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"


class TmdbConfigurationError(Exception):
    pass


def _tmdb_headers() -> dict[str, str]:
    if not settings.tmdb_api_key:
        raise TmdbConfigurationError("TMDB_API_KEY is not configured")
    return {
        "Authorization": f"Bearer {settings.tmdb_api_key}",
        "Accept": "application/json",
    }


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _poster_url(path: str | None) -> str | None:
    if not path:
        return None
    return f"{TMDB_IMAGE_BASE_URL}{path}"


def _normalize_type(media_type: str | None) -> str | None:
    if media_type == "movie":
        return "movie"
    if media_type in {"tv", "series"}:
        return "series"
    return None


def _upsert_title_from_tmdb_result(db: Session, item: dict[str, Any]) -> ContentTitle | None:
    media_type = _normalize_type(item.get("media_type") or item.get("content_type"))
    if media_type is None:
        return None

    tmdb_id = item["id"]
    title = db.scalar(select(ContentTitle).where(ContentTitle.tmdb_id == tmdb_id))
    if title is None:
        title = ContentTitle(
            tmdb_id=tmdb_id,
            content_type=media_type,
            title=item.get("title") or item.get("name") or "Untitled",
            original_title=item.get("original_title") or item.get("original_name"),
            overview=item.get("overview"),
            poster_url=_poster_url(item.get("poster_path")),
            backdrop_url=_poster_url(item.get("backdrop_path")),
            release_date=_parse_date(item.get("release_date") or item.get("first_air_date")),
            tmdb_vote_average=Decimal(str(round(item.get("vote_average") or 0, 1))),
            genres=[
                genre["name"] for genre in item.get("genres", []) if isinstance(genre, dict) and genre.get("name")
            ],
            runtime_minutes=item.get("runtime"),
            season_count=item.get("number_of_seasons"),
            metadata_raw=item,
        )
        db.add(title)
        db.flush()
        return title

    title.content_type = media_type
    title.title = item.get("title") or item.get("name") or title.title
    title.original_title = item.get("original_title") or item.get("original_name")
    title.overview = item.get("overview")
    title.poster_url = _poster_url(item.get("poster_path"))
    title.backdrop_url = _poster_url(item.get("backdrop_path"))
    title.release_date = _parse_date(item.get("release_date") or item.get("first_air_date"))
    title.tmdb_vote_average = Decimal(str(round(item.get("vote_average") or 0, 1)))
    title.genres = [
        genre["name"] for genre in item.get("genres", []) if isinstance(genre, dict) and genre.get("name")
    ]
    title.runtime_minutes = item.get("runtime")
    title.season_count = item.get("number_of_seasons")
    title.metadata_raw = item
    db.flush()
    return title


def search_titles(db: Session, query: str) -> list[ContentTitle]:
    with httpx.Client(base_url=settings.tmdb_base_url, headers=_tmdb_headers(), timeout=15) as client:
        response = client.get("/search/multi", params={"query": query, "include_adult": "false", "language": "en-US"})
        response.raise_for_status()

    items: list[ContentTitle] = []
    for item in response.json().get("results", []):
        media_type = _normalize_type(item.get("media_type"))
        if media_type is None:
            continue
        hydrated = _upsert_title_from_tmdb_result(db, item)
        if hydrated is not None:
            items.append(hydrated)

    db.commit()
    return items


def refresh_title_details(db: Session, title: ContentTitle) -> ContentTitle:
    endpoint = f"/movie/{title.tmdb_id}" if title.content_type == "movie" else f"/tv/{title.tmdb_id}"
    with httpx.Client(base_url=settings.tmdb_base_url, headers=_tmdb_headers(), timeout=15) as client:
        response = client.get(endpoint, params={"language": "en-US"})
        response.raise_for_status()
    refreshed = _upsert_title_from_tmdb_result(db, response.json())
    db.commit()
    return refreshed or title


def refresh_streaming_options(db: Session, title: ContentTitle) -> list[ContentAvailability]:
    endpoint = (
        f"/movie/{title.tmdb_id}/watch/providers"
        if title.content_type == "movie"
        else f"/tv/{title.tmdb_id}/watch/providers"
    )
    with httpx.Client(base_url=settings.tmdb_base_url, headers=_tmdb_headers(), timeout=15) as client:
        response = client.get(endpoint)
        response.raise_for_status()

    us_results = response.json().get("results", {}).get("US", {})
    provider_groups = []
    for key in ("flatrate", "rent", "buy", "ads", "free"):
        provider_groups.extend(us_results.get(key, []))

    existing = db.scalars(select(ContentAvailability).where(ContentAvailability.content_title_id == title.id)).all()
    for availability in existing:
        db.delete(availability)
    db.flush()

    created: list[ContentAvailability] = []
    seen_codes: set[str] = set()
    for provider in provider_groups:
        provider_code = str(provider.get("provider_id"))
        if provider_code in seen_codes:
            continue
        seen_codes.add(provider_code)
        availability = ContentAvailability(
            content_title_id=title.id,
            provider_code=provider_code,
            provider_name=provider.get("provider_name") or "Unknown",
            region_code="US",
            web_url=us_results.get("link"),
            deeplink_url=us_results.get("link"),
            is_connected_priority=False,
        )
        db.add(availability)
        created.append(availability)

    db.commit()
    return created

