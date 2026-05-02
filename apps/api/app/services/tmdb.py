from __future__ import annotations

from datetime import date
from decimal import Decimal
from urllib.parse import quote
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.content import ContentAvailability, ContentTitle

TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w780"
SUPPORTED_PROVIDER_ALIASES = {
    "netflix": ("netflix", "Netflix"),
    "amazon prime video": ("prime_video", "Prime Video"),
    "prime video": ("prime_video", "Prime Video"),
    "apple tv plus": ("apple_tv_plus", "Apple TV+"),
    "appletv+": ("apple_tv_plus", "Apple TV+"),
    "apple tv+": ("apple_tv_plus", "Apple TV+"),
    "max": ("hbo_max", "HBO Max"),
    "hbo max": ("hbo_max", "HBO Max"),
    "disney plus": ("disney_plus", "Disney+"),
    "hulu": ("hulu", "Hulu"),
    "paramount plus": ("paramount_plus", "Paramount+"),
    "peacock premium": ("peacock", "Peacock"),
    "peacock": ("peacock", "Peacock"),
}
PROVIDER_LINK_TEMPLATES = {
    "netflix": {
        "app_url": None,
        "web_url": "https://www.netflix.com/search?q={query}",
    },
    "prime_video": {
        "app_url": None,
        "web_url": "https://www.amazon.com/s?k={query}&i=instant-video",
    },
    "apple_tv_plus": {
        "app_url": None,
        "web_url": "https://tv.apple.com/search?term={query}",
    },
    "hbo_max": {
        "app_url": None,
        "web_url": "https://play.max.com/search?q={query}",
    },
    "disney_plus": {
        "app_url": None,
        "web_url": "https://www.disneyplus.com/search?q={query}",
    },
    "hulu": {
        "app_url": None,
        "web_url": "https://www.hulu.com/search?q={query}",
    },
    "paramount_plus": {
        "app_url": None,
        "web_url": "https://www.paramountplus.com/search/?query={query}",
    },
    "peacock": {
        "app_url": None,
        "web_url": "https://www.peacocktv.com/search?q={query}",
    },
}


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


def _backdrop_url(path: str | None) -> str | None:
    if not path:
        return None
    return f"{TMDB_BACKDROP_IMAGE_BASE_URL}{path}"


def _normalize_type(media_type: str | None) -> str | None:
    if media_type == "movie":
        return "movie"
    if media_type in {"tv", "series"}:
        return "series"
    return None


def build_provider_destination(service_id: str, title_name: str) -> tuple[str | None, str | None]:
    template = PROVIDER_LINK_TEMPLATES.get(service_id)
    if template is None:
        return None, None
    query = quote(title_name.strip())
    app_template = template.get("app_url")
    web_template = template.get("web_url")
    app_url = app_template.format(query=query) if isinstance(app_template, str) and app_template else None
    web_url = web_template.format(query=query) if isinstance(web_template, str) and web_template else None
    return app_url, web_url


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
            backdrop_url=_backdrop_url(item.get("backdrop_path")),
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
    title.backdrop_url = _backdrop_url(item.get("backdrop_path"))
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
        response = client.get(endpoint, params={"language": "en-US", "append_to_response": "credits"})
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
    provider_groups = list(us_results.get("flatrate", []))

    existing = db.scalars(select(ContentAvailability).where(ContentAvailability.content_title_id == title.id)).all()
    for availability in existing:
        db.delete(availability)
    db.flush()

    created: list[ContentAvailability] = []
    seen_codes: set[str] = set()
    for provider in provider_groups:
        provider_name = provider.get("provider_name") or "Unknown"
        normalized = SUPPORTED_PROVIDER_ALIASES.get(str(provider_name).strip().lower())
        if normalized is None:
            continue
        provider_code, canonical_name = normalized
        if provider_code in seen_codes:
            continue
        seen_codes.add(provider_code)
        app_url, web_url = build_provider_destination(provider_code, title.title)
        availability = ContentAvailability(
            content_title_id=title.id,
            provider_code=provider_code,
            provider_name=canonical_name,
            region_code="US",
            web_url=web_url,
            deeplink_url=app_url,
            is_connected_priority=False,
        )
        db.add(availability)
        created.append(availability)

    db.commit()
    return created


def fetch_title_gallery(title: ContentTitle, limit: int = 12) -> list[dict[str, Any]]:
    endpoint = f"/movie/{title.tmdb_id}/images" if title.content_type == "movie" else f"/tv/{title.tmdb_id}/images"
    with httpx.Client(base_url=settings.tmdb_base_url, headers=_tmdb_headers(), timeout=15) as client:
        response = client.get(endpoint)
        response.raise_for_status()

    data = response.json()
    gallery: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for item in data.get("backdrops", []):
        url = _backdrop_url(item.get("file_path"))
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        gallery.append(
            {
                "url": url,
                "kind": "backdrop",
                "width": item.get("width"),
                "height": item.get("height"),
            }
        )
        if len(gallery) >= limit:
            return gallery

    for item in data.get("posters", []):
        url = _poster_url(item.get("file_path"))
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        gallery.append(
            {
                "url": url,
                "kind": "poster",
                "width": item.get("width"),
                "height": item.get("height"),
            }
        )
        if len(gallery) >= limit:
            return gallery

    return gallery


def fetch_related_titles(db: Session, title: ContentTitle, limit: int = 10) -> list[ContentTitle]:
    endpoint_root = "movie" if title.content_type == "movie" else "tv"
    with httpx.Client(base_url=settings.tmdb_base_url, headers=_tmdb_headers(), timeout=15) as client:
        rec_response = client.get(
            f"/{endpoint_root}/{title.tmdb_id}/recommendations",
            params={"language": "en-US", "page": 1},
        )
        rec_response.raise_for_status()
        sim_response = client.get(
            f"/{endpoint_root}/{title.tmdb_id}/similar",
            params={"language": "en-US", "page": 1},
        )
        sim_response.raise_for_status()

    hydrated: list[ContentTitle] = []
    seen_tmdb_ids: set[int] = set()
    for item in [*rec_response.json().get("results", []), *sim_response.json().get("results", [])]:
        tmdb_id = item.get("id")
        if not isinstance(tmdb_id, int) or tmdb_id in seen_tmdb_ids:
            continue
        seen_tmdb_ids.add(tmdb_id)
        item["media_type"] = "movie" if endpoint_root == "movie" else "tv"
        row = _upsert_title_from_tmdb_result(db, item)
        if row is not None:
            hydrated.append(row)
        if len(hydrated) >= limit:
            break

    db.commit()
    return hydrated


def fetch_trending_titles(db: Session, limit: int = 20) -> list[ContentTitle]:
    with httpx.Client(base_url=settings.tmdb_base_url, headers=_tmdb_headers(), timeout=15) as client:
        response = client.get("/trending/all/week", params={"language": "en-US"})
        response.raise_for_status()

    hydrated: list[ContentTitle] = []
    for item in response.json().get("results", []):
        row = _upsert_title_from_tmdb_result(db, item)
        if row is not None:
            hydrated.append(row)
        if len(hydrated) >= limit:
            break
    db.commit()
    return hydrated


def list_tmdb_genres() -> list[str]:
    movie_map = _fetch_genre_map("movie")
    tv_map = _fetch_genre_map("tv")
    merged = sorted({*movie_map.values(), *tv_map.values()})
    return merged


def discover_titles_by_genre(
    db: Session,
    genre: str,
    media_type: str = "all",
    limit: int = 40,
) -> list[ContentTitle]:
    genre = genre.strip().lower()
    if not genre:
        return []

    requested = {"all", "movie", "show"}
    if media_type not in requested:
        media_type = "all"

    movie_map = _fetch_genre_map("movie")
    tv_map = _fetch_genre_map("tv")
    movie_id = _match_genre_id(movie_map, genre)
    tv_id = _match_genre_id(tv_map, genre)

    if media_type == "movie" and movie_id is None:
        return []
    if media_type == "show" and tv_id is None:
        return []
    if media_type == "all" and movie_id is None and tv_id is None:
        return []

    fetched: list[ContentTitle] = []
    seen_tmdb_ids: set[int] = set()
    with httpx.Client(base_url=settings.tmdb_base_url, headers=_tmdb_headers(), timeout=15) as client:
        if media_type in {"all", "movie"} and movie_id is not None:
            response = client.get(
                "/discover/movie",
                params={
                    "language": "en-US",
                    "sort_by": "popularity.desc",
                    "include_adult": "false",
                    "include_video": "false",
                    "with_genres": str(movie_id),
                    "page": 1,
                },
            )
            response.raise_for_status()
            for item in response.json().get("results", []):
                tmdb_id = item.get("id")
                if not isinstance(tmdb_id, int) or tmdb_id in seen_tmdb_ids:
                    continue
                seen_tmdb_ids.add(tmdb_id)
                item["media_type"] = "movie"
                item["genres"] = [
                    {"name": movie_map[g]} for g in item.get("genre_ids", []) if isinstance(g, int) and g in movie_map
                ]
                hydrated = _upsert_title_from_tmdb_result(db, item)
                if hydrated is not None:
                    fetched.append(hydrated)
                if len(fetched) >= limit:
                    db.commit()
                    return fetched[:limit]

        if media_type in {"all", "show"} and tv_id is not None:
            response = client.get(
                "/discover/tv",
                params={
                    "language": "en-US",
                    "sort_by": "popularity.desc",
                    "include_adult": "false",
                    "with_genres": str(tv_id),
                    "page": 1,
                },
            )
            response.raise_for_status()
            for item in response.json().get("results", []):
                tmdb_id = item.get("id")
                if not isinstance(tmdb_id, int) or tmdb_id in seen_tmdb_ids:
                    continue
                seen_tmdb_ids.add(tmdb_id)
                item["media_type"] = "tv"
                item["genres"] = [
                    {"name": tv_map[g]} for g in item.get("genre_ids", []) if isinstance(g, int) and g in tv_map
                ]
                hydrated = _upsert_title_from_tmdb_result(db, item)
                if hydrated is not None:
                    fetched.append(hydrated)
                if len(fetched) >= limit:
                    db.commit()
                    return fetched[:limit]

    db.commit()
    return fetched[:limit]


def _fetch_genre_map(kind: str) -> dict[int, str]:
    with httpx.Client(base_url=settings.tmdb_base_url, headers=_tmdb_headers(), timeout=15) as client:
        response = client.get(f"/genre/{kind}/list", params={"language": "en-US"})
        response.raise_for_status()
    return {
        int(item["id"]): str(item["name"])
        for item in response.json().get("genres", [])
        if isinstance(item, dict) and isinstance(item.get("id"), int) and isinstance(item.get("name"), str)
    }


def _match_genre_id(mapping: dict[int, str], target: str) -> int | None:
    normalized = target.lower()
    for genre_id, name in mapping.items():
        if name.lower() == normalized:
            return genre_id
    return None
