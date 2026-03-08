from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any
from urllib.parse import quote

import httpx

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIPEDIA_SUMMARY_API = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"


@dataclass
class WikipediaMetadata:
    title: str | None = None
    year: int | None = None
    synopsis: str | None = None
    runtime_minutes: int | None = None
    seasons: int | None = None
    episodes: int | None = None
    genres: list[str] | None = None
    director: str | None = None
    creator: str | None = None
    cast: list[str] | None = None
    language: str | None = None
    country: str | None = None
    wikipedia_url: str | None = None
    image_url: str | None = None
    production_company: str | None = None
    metadata_source: str = "wikipedia"


def _normalize(text: str) -> str:
    base = re.sub(r"\s+", " ", re.sub(r"[\(\)\[\]\-_:,.'\"]", " ", text.lower())).strip()
    base = re.sub(r"\b(film|movie|tv|television|series|miniseries)\b", " ", base)
    return re.sub(r"\s+", " ", base).strip()


def _strip_disambiguation_suffix(title: str) -> str:
    stripped = re.sub(r"\s*\((film|movie|tv series|television series|miniseries|american tv series|american television series)\)\s*$", "", title, flags=re.IGNORECASE)
    return stripped.strip()


def _title_variants(title: str) -> list[str]:
    base = title.strip()
    cleaned = _strip_disambiguation_suffix(base)
    variants = [base]
    if cleaned and cleaned.lower() != base.lower():
        variants.append(cleaned)
    variants.append(re.sub(r"[\"'’`]", "", cleaned))
    return [value for value in dict.fromkeys(v for v in variants if v.strip())]


def _build_queries(title: str, year: int | None, content_type: str) -> list[str]:
    media_hint = "film" if content_type == "movie" else "television series"
    queries: list[str] = []
    for variant in _title_variants(title):
        queries.append(variant)
        queries.append(f"{variant} ({media_hint})")
        if year:
            year_hint = "film" if content_type == "movie" else "TV series"
            queries.append(f"{variant} ({year} {year_hint})")
            queries.append(f"{variant} {year} {media_hint}")
        queries.append(f"{variant} wikipedia")
    return queries


def _score_candidate(candidate_title: str, search_title: str, year: int | None, content_type: str) -> float:
    score = 0.0
    c_norm = _normalize(candidate_title)
    s_norm = _normalize(_strip_disambiguation_suffix(search_title))
    if c_norm == s_norm:
        score += 8.0
    if s_norm in c_norm:
        score += 3.0
    if year and str(year) in candidate_title:
        score += 2.0
    if content_type == "movie" and "film" in candidate_title.lower():
        score += 1.5
    if content_type != "movie" and ("television" in candidate_title.lower() or "series" in candidate_title.lower()):
        score += 1.5
    if "disambiguation" in candidate_title.lower():
        score -= 4.0
    if "list of" in candidate_title.lower():
        score -= 3.0
    return score


def _extract_entity_id(page: dict[str, Any]) -> str | None:
    return page.get("pageprops", {}).get("wikibase_item")


def _entity_ids_from_claims(claims: dict[str, Any], prop: str, max_items: int = 10) -> list[str]:
    values: list[str] = []
    for claim in claims.get(prop, [])[:max_items]:
        mainsnak = claim.get("mainsnak", {})
        datavalue = mainsnak.get("datavalue", {})
        value = datavalue.get("value", {})
        if isinstance(value, dict) and value.get("id"):
            values.append(value["id"])
    return values


def _first_int_claim(claims: dict[str, Any], prop: str) -> int | None:
    for claim in claims.get(prop, []):
        mainsnak = claim.get("mainsnak", {})
        datavalue = mainsnak.get("datavalue", {})
        value = datavalue.get("value")
        if isinstance(value, dict) and "amount" in value:
            try:
                return int(float(str(value["amount"]).lstrip("+")))
            except ValueError:
                continue
    return None


def _first_time_claim_year(claims: dict[str, Any], prop: str) -> int | None:
    for claim in claims.get(prop, []):
        mainsnak = claim.get("mainsnak", {})
        datavalue = mainsnak.get("datavalue", {})
        value = datavalue.get("value", {})
        time_value = value.get("time") if isinstance(value, dict) else None
        if isinstance(time_value, str) and len(time_value) >= 5:
            try:
                return int(time_value[1:5])
            except ValueError:
                continue
    return None


def _resolve_labels(client: httpx.Client, ids: list[str]) -> dict[str, str]:
    if not ids:
        return {}
    unique = list(dict.fromkeys(ids))
    response = client.get(
        WIKIDATA_API,
        params={
            "action": "wbgetentities",
            "format": "json",
            "props": "labels",
            "languages": "en",
            "ids": "|".join(unique),
        },
    )
    response.raise_for_status()
    entities = response.json().get("entities", {})
    labels: dict[str, str] = {}
    for entity_id, entity in entities.items():
        label = entity.get("labels", {}).get("en", {}).get("value")
        if label:
            labels[entity_id] = label
    return labels


def _extract_intro_and_image(client: httpx.Client, page_title: str) -> tuple[str | None, str | None]:
    details = client.get(
        WIKIPEDIA_API,
        params={
            "action": "query",
            "format": "json",
            "prop": "extracts|pageimages",
            "titles": page_title,
            "redirects": 1,
            "exintro": 1,
            "explaintext": 1,
            "pithumbsize": 1200,
        },
    )
    details.raise_for_status()
    pages = details.json().get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})
    extract = page.get("extract") if isinstance(page, dict) else None
    thumbnail = page.get("thumbnail", {}).get("source") if isinstance(page, dict) else None
    return extract, thumbnail


def resolve_wikipedia_metadata(
    *,
    title: str,
    release_date: date | None,
    content_type: str,
) -> WikipediaMetadata | None:
    year = release_date.year if release_date else None
    queries = _build_queries(title, year, content_type)
    with httpx.Client(
        timeout=12,
        headers={"User-Agent": "SeenSnap/1.0 (metadata resolver; contact: demo@seensnap.app)"},
    ) as client:
        best_page: dict[str, Any] | None = None
        best_score = -1.0
        for query in queries:
            search = client.get(
                WIKIPEDIA_API,
                params={
                    "action": "query",
                    "list": "search",
                    "format": "json",
                    "srlimit": 6,
                    "srsearch": query,
                },
            )
            search.raise_for_status()
            for candidate in search.json().get("query", {}).get("search", []):
                score = _score_candidate(candidate.get("title", ""), title, year, content_type)
                if score > best_score:
                    best_score = score
                    best_page = candidate
            if best_score >= 8:
                break

        if best_page is None or best_score <= 0:
            return None

        page_title = best_page.get("title")
        if not page_title:
            return None

        summary_json: dict[str, Any] = {}
        try:
            summary = client.get(f"{WIKIPEDIA_SUMMARY_API}/{quote(page_title)}")
            if summary.status_code == 200:
                summary_json = summary.json()
        except httpx.HTTPError:
            summary_json = {}

        try:
            extract_text, fallback_image = _extract_intro_and_image(client, page_title)
        except httpx.HTTPError:
            extract_text, fallback_image = (None, None)
        summary_text = summary_json.get("extract") if isinstance(summary_json, dict) else None
        synopsis = summary_text or extract_text

        metadata = WikipediaMetadata(
            title=(summary_json.get("title") if isinstance(summary_json, dict) else None) or page_title,
            synopsis=synopsis,
            wikipedia_url=(
                summary_json.get("content_urls", {}).get("desktop", {}).get("page")
                if isinstance(summary_json, dict)
                else None
            )
            or f"https://en.wikipedia.org/wiki/{quote(page_title.replace(' ', '_'))}",
            image_url=(
                summary_json.get("thumbnail", {}).get("source")
                if isinstance(summary_json, dict)
                else None
            )
            or fallback_image,
            year=year,
            genres=[],
            cast=[],
        )

        try:
            details = client.get(
                WIKIPEDIA_API,
                params={
                    "action": "query",
                    "format": "json",
                    "prop": "pageprops",
                    "titles": page_title,
                    "redirects": 1,
                },
            )
            details.raise_for_status()
            pages = details.json().get("query", {}).get("pages", {})
            page = next(iter(pages.values()), {})
            entity_id = _extract_entity_id(page)
        except httpx.HTTPError:
            entity_id = None

        if not entity_id:
            return metadata

        entity_resp = client.get(
            WIKIDATA_API,
            params={
                "action": "wbgetentities",
                "format": "json",
                "props": "claims",
                "ids": entity_id,
            },
        )
        entity_resp.raise_for_status()
        entity = entity_resp.json().get("entities", {}).get(entity_id, {})
        claims = entity.get("claims", {})

        metadata.year = _first_time_claim_year(claims, "P577") or metadata.year
        metadata.runtime_minutes = _first_int_claim(claims, "P2047")
        metadata.seasons = _first_int_claim(claims, "P2437")
        metadata.episodes = _first_int_claim(claims, "P1113")

        genre_ids = _entity_ids_from_claims(claims, "P136", 6)
        director_ids = _entity_ids_from_claims(claims, "P57", 1)
        creator_ids = _entity_ids_from_claims(claims, "P170", 1) or _entity_ids_from_claims(claims, "P58", 1)
        cast_ids = _entity_ids_from_claims(claims, "P161", 5)
        language_ids = _entity_ids_from_claims(claims, "P364", 1)
        country_ids = _entity_ids_from_claims(claims, "P495", 1)
        company_ids = _entity_ids_from_claims(claims, "P272", 1)

        labels = _resolve_labels(
            client,
            genre_ids + director_ids + creator_ids + cast_ids + language_ids + country_ids + company_ids,
        )

        metadata.genres = [labels[i] for i in genre_ids if i in labels]
        metadata.director = labels.get(director_ids[0]) if director_ids else None
        metadata.creator = labels.get(creator_ids[0]) if creator_ids else None
        metadata.cast = [labels[i] for i in cast_ids if i in labels]
        metadata.language = labels.get(language_ids[0]) if language_ids else None
        metadata.country = labels.get(country_ids[0]) if country_ids else None
        metadata.production_company = labels.get(company_ids[0]) if company_ids else None
        return metadata
