from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.content import ContentAvailability, ContentTitle
from app.models.social import FeedComment, FeedReaction, Rating, Review, TeamRanking, TeamTitle, Watchlist, WatchlistItem
from app.models.taste import RecommendationSignal, SwipeRecord, UserTasteProfile, WrappedStat
from app.models.user import UserPreferences
from app.schemas.content import RecommendationResponse
from app.schemas.taste import TasteProfileResponse, TasteTitleReferenceResponse
from app.services.teams import list_user_teams
from app.services.tmdb import TmdbConfigurationError, fetch_related_titles, fetch_trending_titles

THEME_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Slow Burn": ("drama", "mystery", "thriller"),
    "Emotionally Intense": ("drama", "romance"),
    "Character Driven": ("drama", "indie"),
    "Visually Bold": ("sci-fi", "fantasy", "animation", "horror"),
    "High Stakes": ("action", "crime", "thriller"),
    "Comfort Rewatch": ("comedy", "family"),
}

LABEL_RULES: dict[str, dict[str, object]] = {
    "Prestige Drama": {"genres": {"Drama": 1.0, "TV Movie": 0.2}, "themes": {"Slow Burn", "Character Driven"}},
    "Awards Season Core": {"genres": {"Drama": 0.9, "History": 0.6}},
    "Character Study Fan": {"genres": {"Drama": 0.8, "Romance": 0.4}, "themes": {"Character Driven"}},
    "Emotional Realist": {"genres": {"Drama": 0.8}, "themes": {"Emotionally Intense"}},
    "Dark Crime": {"genres": {"Crime": 1.0, "Mystery": 0.7, "Thriller": 0.6}},
    "Psychological Thriller": {"genres": {"Thriller": 1.0, "Mystery": 0.6, "Crime": 0.5}},
    "Serial Killer TV": {"genres": {"Crime": 0.9, "Thriller": 0.7}},
    "Neo-Noir": {"genres": {"Crime": 0.9, "Thriller": 0.5}},
    "Comfort Comedy": {"genres": {"Comedy": 1.0, "Family": 0.3}, "themes": {"Comfort Rewatch"}},
    "Dry Humor": {"genres": {"Comedy": 0.9}},
    "Chaos Comedy": {"genres": {"Comedy": 1.0, "Action": 0.2}},
    "Sitcom Loyalist": {"genres": {"Comedy": 1.0}},
    "Cerebral Sci-Fi": {"genres": {"Science Fiction": 1.0, "Mystery": 0.3}, "themes": {"Slow Burn", "Visually Bold"}},
    "Space Opera": {"genres": {"Science Fiction": 1.0, "Adventure": 0.6, "Fantasy": 0.4}},
    "Dystopian Future": {"genres": {"Science Fiction": 0.9, "Thriller": 0.4}},
    "Time Loop Enthusiast": {"genres": {"Science Fiction": 0.9, "Fantasy": 0.4}},
    "A24-Core": {"genres": {"Drama": 0.7, "Horror": 0.5}, "themes": {"Visually Bold", "Character Driven"}},
    "Indie Darling": {"genres": {"Drama": 0.6, "Comedy": 0.3}, "themes": {"Character Driven"}},
    "Festival Circuit": {"genres": {"Drama": 0.7, "Documentary": 0.6}},
    "Cinematic Maximalist": {"genres": {"Action": 0.5, "Fantasy": 0.5, "Science Fiction": 0.5}, "themes": {"Visually Bold"}},
    "Elevated Horror": {"genres": {"Horror": 1.0, "Thriller": 0.5}, "themes": {"Slow Burn", "Visually Bold"}},
    "Atmospheric Horror": {"genres": {"Horror": 1.0, "Mystery": 0.5}, "themes": {"Slow Burn"}},
    "Camp Horror": {"genres": {"Horror": 0.9, "Comedy": 0.3}},
    "Survival Horror": {"genres": {"Horror": 0.9, "Action": 0.4, "Thriller": 0.5}},
}

SWIPE_DIRECTION_WEIGHTS: dict[str, float] = {
    "left": -3.5,
    "right": 5.0,
    "up": 8.0,
}


def refresh_taste_profile(db: Session, user_id: UUID) -> UserTasteProfile:
    profile = db.scalar(select(UserTasteProfile).where(UserTasteProfile.user_id == user_id))
    if profile is None:
        profile = UserTasteProfile(user_id=user_id)
        db.add(profile)
        db.flush()

    genre_scores, title_refs, release_years = _collect_title_signals(db, user_id)
    themes = _derive_themes(genre_scores)
    platforms = _derive_platforms(db, user_id)
    eras = _derive_eras(release_years)
    labels = _derive_labels(genre_scores, themes)
    current_obsessions = _derive_current_obsessions(title_refs)
    posters = [item["poster_url"] for item in current_obsessions if item.get("poster_url")][:4]
    most_saved_genre = max(genre_scores.items(), key=lambda item: item[1])[0] if genre_scores else None
    signal_counts = _signal_counts(db, user_id)

    profile.top_genres = _serialize_genres(genre_scores)
    profile.top_themes = themes
    profile.top_platforms = platforms
    profile.favorite_eras = eras
    profile.taste_labels = labels
    profile.profile_summary = _build_summary(profile.top_genres, profile.top_themes, profile.taste_labels)
    profile.current_obsessions = current_obsessions
    profile.top_posters = posters
    profile.most_saved_genre = most_saved_genre
    profile.signal_counts = signal_counts
    profile.updated_at = datetime.now(timezone.utc)

    _refresh_wrapped_stat(db, user_id, profile)
    db.commit()
    db.refresh(profile)
    return profile


def get_taste_profile(db: Session, user_id: UUID, *, force_refresh: bool = False) -> UserTasteProfile:
    profile = db.scalar(select(UserTasteProfile).where(UserTasteProfile.user_id == user_id))
    if profile is None or force_refresh or _is_stale(profile.updated_at, hours=12):
        return refresh_taste_profile(db, user_id)
    return profile


def to_taste_profile_response(profile: UserTasteProfile) -> TasteProfileResponse:
    return TasteProfileResponse(
        user_id=profile.user_id,
        top_genres=profile.top_genres or [],
        top_themes=profile.top_themes or [],
        top_platforms=profile.top_platforms or [],
        favorite_eras=profile.favorite_eras or [],
        taste_labels=profile.taste_labels or [],
        profile_summary=profile.profile_summary,
        current_obsessions=[TasteTitleReferenceResponse(**item) for item in (profile.current_obsessions or [])],
        top_posters=profile.top_posters or [],
        most_saved_genre=profile.most_saved_genre,
        updated_at=profile.updated_at,
    )


def get_social_recommendations(
    db: Session,
    user_id: UUID,
    *,
    limit: int = 24,
    preferred_type: str | None = None,
) -> list[RecommendationResponse]:
    taste_profile = get_taste_profile(db, user_id)
    saved_ids = db.scalars(
        select(WatchlistItem.content_title_id)
        .join(Watchlist, Watchlist.id == WatchlistItem.watchlist_id)
        .where(Watchlist.owner_user_id == user_id)
    ).all()
    saved_set = set(saved_ids)
    team_ids = [team.id for team, _ in list_user_teams(db, user_id)]
    swipe_rows = db.execute(
        select(SwipeRecord, ContentTitle)
        .join(ContentTitle, ContentTitle.id == SwipeRecord.content_title_id)
        .where(SwipeRecord.user_id == user_id)
        .order_by(SwipeRecord.created_at.desc())
        .limit(250)
    ).all()
    dismissed_ids = {
        title.id
        for swipe, title in swipe_rows
        if swipe.direction == "left" and title is not None
    }
    positive_swipes = [
        (swipe, title)
        for swipe, title in swipe_rows
        if swipe.direction in {"right", "up"} and title is not None
    ]

    ranked: dict[UUID, dict] = {}
    db.query(RecommendationSignal).filter(RecommendationSignal.user_id == user_id).delete(synchronize_session=False)

    if team_ids:
        team_title_counts = db.execute(
            select(TeamTitle.content_title_id, func.count(TeamTitle.id).label("uses"))
            .where(TeamTitle.team_id.in_(team_ids))
            .group_by(TeamTitle.content_title_id)
            .order_by(func.count(TeamTitle.id).desc())
            .limit(limit * 3)
        ).all()
        title_map = {
            title.id: title
            for title in db.scalars(
                select(ContentTitle).where(ContentTitle.id.in_([title_id for title_id, _ in team_title_counts]))
            ).all()
        }
        for title_id, uses in team_title_counts:
            if title_id in saved_set:
                continue
            title = title_map.get(title_id)
            if title is None:
                continue
            ranked[title.id] = {
                "title": title,
                "score": int(uses) * 12,
                "reason": f"{int(uses)} people in your Watch Teams saved this",
                "signal_type": "team_based",
            }

    seed_ids = [item.get("title_id") for item in (taste_profile.current_obsessions or []) if item.get("title_id")]
    if seed_ids:
        seed_titles = db.scalars(
            select(ContentTitle).where(ContentTitle.id.in_([UUID(str(item)) for item in seed_ids]))
        ).all()
        for seed in seed_titles[:4]:
            try:
                related = fetch_related_titles(db, seed, limit=8)
            except TmdbConfigurationError:
                related = []
            for idx, candidate in enumerate(related):
                if candidate.id in saved_set or candidate.id in dismissed_ids:
                    continue
                entry = ranked.setdefault(
                    candidate.id,
                    {
                        "title": candidate,
                        "score": 0,
                        "reason": f"Perfect for your {taste_profile.taste_labels[0]['label']} taste profile" if taste_profile.taste_labels else f"Because you liked {seed.title}",
                        "signal_type": "taste_based",
                    },
                )
                entry["score"] += max(10 - idx, 1)

    for swipe, seed in positive_swipes[:20]:
        try:
            related = fetch_related_titles(db, seed, limit=6)
        except TmdbConfigurationError:
            related = []
        for idx, candidate in enumerate(related):
            if candidate.id in saved_set or candidate.id in dismissed_ids:
                continue
            entry = ranked.setdefault(
                candidate.id,
                {
                    "title": candidate,
                    "score": 0,
                    "reason": f"You swiped {'up' if swipe.direction == 'up' else 'right'} on {seed.title}. This keeps that streak going.",
                    "signal_type": "swipe_based",
                },
            )
            entry["score"] += max(12 - idx, 3) + (4 if swipe.direction == "up" else 2)

    top_platform = (taste_profile.top_platforms or [None])[0]
    if top_platform:
        provider_rows = db.execute(
            select(ContentAvailability.content_title_id, func.count(ContentAvailability.id).label("hits"))
            .where(
                func.lower(ContentAvailability.provider_name) == top_platform.lower(),
            )
            .group_by(ContentAvailability.content_title_id)
            .order_by(func.count(ContentAvailability.id).desc())
            .limit(limit * 2)
        ).all()
        provider_ids = [title_id for title_id, _ in provider_rows if title_id not in saved_set and title_id not in dismissed_ids]
        provider_title_map = {
            title.id: title
            for title in db.scalars(select(ContentTitle).where(ContentTitle.id.in_(provider_ids))).all()
        }
        for title_id, hits in provider_rows:
            if title_id in saved_set or title_id in dismissed_ids:
                continue
            title = provider_title_map.get(title_id)
            if title is None:
                continue
            entry = ranked.setdefault(
                title.id,
                {
                    "title": title,
                    "score": 0,
                    "reason": f"Trending on {top_platform} among users like you",
                    "signal_type": "streaming_based",
                },
            )
            entry["score"] += int(hits) * 5

    chosen = sorted(
        ranked.values(),
        key=lambda item: (item["score"], float(item["title"].tmdb_vote_average or 0)),
        reverse=True,
    )
    if preferred_type == "movie":
        chosen = [item for item in chosen if item["title"].content_type == "movie"]
    elif preferred_type == "show":
        chosen = [item for item in chosen if item["title"].content_type == "series"]

    chosen = chosen[:limit]
    if not chosen:
        try:
            fallback = fetch_trending_titles(db, limit=limit * 2)
        except TmdbConfigurationError:
            fallback = []
        fallback = [title for title in fallback if title.id not in saved_set and title.id not in dismissed_ids]
        if preferred_type == "movie":
            fallback = [title for title in fallback if title.content_type == "movie"]
        elif preferred_type == "show":
            fallback = [title for title in fallback if title.content_type == "series"]
        chosen = [
            {"title": title, "score": 1, "reason": "Trending in the SeenSnap network", "signal_type": "trending"}
            for title in fallback[:limit]
        ]

    results: list[RecommendationResponse] = []
    from app.api.routes.titles import _to_title_response  # local import to avoid cycle at module load

    for item in chosen:
        db.add(
            RecommendationSignal(
                user_id=user_id,
                content_title_id=item["title"].id,
                signal_type=item["signal_type"],
                weight=int(item["score"]),
                reason=item["reason"],
                metadata_json={"preferred_type": preferred_type} if preferred_type else {},
            )
        )
        results.append(
            RecommendationResponse(
                title=_to_title_response(item["title"]),
                reason=item["reason"],
                seed_title_id=None,
            )
        )
    db.commit()
    return results


def record_swipe(
    db: Session,
    user_id: UUID,
    *,
    title_id: UUID,
    direction: str,
    pause_ms: int | None = None,
    session_id: str | None = None,
    reason: str | None = None,
) -> SwipeRecord:
    if direction not in SWIPE_DIRECTION_WEIGHTS:
        raise ValueError(f"Unsupported swipe direction: {direction}")

    record = SwipeRecord(
        user_id=user_id,
        content_title_id=title_id,
        direction=direction,
        pause_ms=pause_ms,
        session_id=session_id,
        reason=reason,
    )
    db.add(record)
    db.flush()
    _prune_old_swipes(db, user_id)
    refresh_taste_profile(db, user_id)
    db.refresh(record)
    return record


def _collect_title_signals(db: Session, user_id: UUID) -> tuple[defaultdict[str, float], list[dict], list[int]]:
    genre_scores: defaultdict[str, float] = defaultdict(float)
    title_refs: dict[UUID, dict] = {}
    release_years: list[int] = []
    team_ids = [team.id for team, _ in list_user_teams(db, user_id)]

    def apply_title(title: ContentTitle | None, weight: float) -> None:
        if title is None:
            return
        for genre in _title_genres(title):
            genre_scores[genre] += weight
        if title.id not in title_refs:
            title_refs[title.id] = {
                "title_id": str(title.id),
                "title_name": title.title,
                "poster_url": title.poster_url,
                "weight": 0.0,
            }
        title_refs[title.id]["weight"] += weight
        if title.release_date is not None:
            release_years.append(title.release_date.year)

    ratings = db.execute(
        select(Rating, ContentTitle)
        .join(ContentTitle, ContentTitle.id == Rating.content_title_id)
        .where(Rating.user_id == user_id)
    ).all()
    for rating, title in ratings:
        apply_title(title, max(float(rating.score) - 4.5, 0.5) * 6)

    reviews = db.execute(
        select(Review, ContentTitle)
        .join(ContentTitle, ContentTitle.id == Review.content_title_id)
        .where(Review.user_id == user_id)
    ).all()
    for review, title in reviews:
        apply_title(title, 5 if review.body else 3)

    watchlist_items = db.execute(
        select(WatchlistItem, Watchlist, ContentTitle)
        .join(Watchlist, Watchlist.id == WatchlistItem.watchlist_id)
        .join(ContentTitle, ContentTitle.id == WatchlistItem.content_title_id)
        .where(Watchlist.owner_user_id == user_id)
    ).all()
    for item, watchlist, title in watchlist_items:
        bonus = 14 if watchlist.name.lower() == "favorites" else 10 if watchlist.is_default else 8
        if item.position is not None:
            bonus += max(10 - item.position, 1)
        apply_title(title, bonus)

    team_rankings = (
        db.execute(
            select(TeamRanking, ContentTitle)
            .join(ContentTitle, ContentTitle.id == TeamRanking.content_title_id)
            .where(TeamRanking.team_id.in_(team_ids))
        ).all()
        if team_ids
        else []
    )
    for ranking, title in team_rankings:
        apply_title(title, max(12 - ranking.rank, 2) + float(ranking.score))

    reactions = db.scalar(select(func.count(FeedReaction.id)).where(FeedReaction.user_id == user_id)) or 0
    if reactions and genre_scores:
        lead_genre = max(genre_scores.items(), key=lambda item: item[1])[0]
        genre_scores[lead_genre] += reactions * 0.35

    comments = db.scalar(select(func.count(FeedComment.id)).where(FeedComment.user_id == user_id)) or 0
    if comments and genre_scores:
        lead_genre = max(genre_scores.items(), key=lambda item: item[1])[0]
        genre_scores[lead_genre] += comments * 0.5

    swipe_rows = db.execute(
        select(SwipeRecord, ContentTitle)
        .join(ContentTitle, ContentTitle.id == SwipeRecord.content_title_id)
        .where(SwipeRecord.user_id == user_id)
        .order_by(SwipeRecord.created_at.desc())
        .limit(250)
    ).all()
    for swipe, title in swipe_rows:
        if title is None:
            continue
        weight = SWIPE_DIRECTION_WEIGHTS.get(swipe.direction, 0.0)
        if weight > 0:
            apply_title(title, weight)
            continue
        for genre in _title_genres(title):
            genre_scores[genre] += weight
            if genre_scores[genre] < 0:
                genre_scores[genre] = 0

    ordered_titles = sorted(title_refs.values(), key=lambda item: item["weight"], reverse=True)
    return genre_scores, ordered_titles, release_years


def _derive_themes(genre_scores: dict[str, float]) -> list[str]:
    themes: list[tuple[str, float]] = []
    lowered = {genre.lower(): score for genre, score in genre_scores.items()}
    for theme, matches in THEME_KEYWORDS.items():
        score = sum(value for genre, value in lowered.items() if any(token in genre for token in matches))
        if score > 0:
            themes.append((theme, score))
    return [name for name, _ in sorted(themes, key=lambda item: item[1], reverse=True)[:3]]


def _title_genres(title: ContentTitle) -> list[str]:
    if title.genres:
        return [genre for genre in title.genres if genre]
    metadata = title.metadata_raw or {}
    if isinstance(metadata, dict):
        raw_genres = metadata.get("genres")
        if isinstance(raw_genres, list):
            extracted: list[str] = []
            for item in raw_genres:
                if isinstance(item, str) and item:
                    extracted.append(item)
                elif isinstance(item, dict) and isinstance(item.get("name"), str):
                    extracted.append(item["name"])
            if extracted:
                return extracted
    overview = (title.overview or "").lower()
    heuristic_map = {
        "Drama": ("family", "relationship", "career", "marriage"),
        "Thriller": ("murder", "conspiracy", "investigation", "danger"),
        "Comedy": ("funny", "comedy", "awkward", "satire"),
        "Science Fiction": ("space", "future", "technology", "dystopian"),
        "Horror": ("haunted", "terror", "curse", "horror"),
        "Crime": ("crime", "detective", "cartel", "serial killer"),
        "Romance": ("love", "romance", "relationship"),
    }
    guessed = [genre for genre, tokens in heuristic_map.items() if any(token in overview for token in tokens)]
    return guessed


def _derive_platforms(db: Session, user_id: UUID) -> list[str]:
    preferences = db.scalar(select(UserPreferences).where(UserPreferences.user_id == user_id))
    provider_counts = Counter()
    rows = db.execute(
        select(ContentAvailability.provider_name)
        .join(ContentTitle, ContentTitle.id == ContentAvailability.content_title_id)
        .join(WatchlistItem, WatchlistItem.content_title_id == ContentTitle.id)
        .join(Watchlist, Watchlist.id == WatchlistItem.watchlist_id)
        .where(Watchlist.owner_user_id == user_id)
    ).all()
    for (provider_name,) in rows:
        if provider_name:
            provider_counts[provider_name] += 1
    ordered = [name for name, _ in provider_counts.most_common(3)]
    if preferences is not None:
        for service in preferences.connected_streaming_services or []:
            normalized = service.replace("_", " ").title()
            if normalized not in ordered:
                ordered.append(normalized)
    return ordered[:3]


def _derive_eras(years: list[int]) -> list[str]:
    if not years:
        return []
    buckets = Counter()
    for year in years:
        decade = f"{year // 10 * 10}s"
        buckets[decade] += 1
        if year >= 2010:
            buckets["Modern Prestige TV"] += 0.4
        elif year >= 1990:
            buckets["Late Century Essentials"] += 0.25
    return [name for name, _ in buckets.most_common(2)]


def _derive_labels(genre_scores: dict[str, float], themes: list[str]) -> list[dict]:
    if not genre_scores:
        return []
    genre_total = sum(genre_scores.values()) or 1
    normalized = {genre: value / genre_total for genre, value in genre_scores.items()}
    theme_set = set(themes)
    results: list[dict] = []
    for label, rule in LABEL_RULES.items():
        score = 0.0
        for genre, weight in (rule.get("genres") or {}).items():
            score += normalized.get(genre, 0.0) * float(weight) * 100
        if theme_set.intersection(rule.get("themes") or set()):
            score += 12
        confidence = min(int(round(score)), 99)
        if confidence >= 35:
            results.append({"label": label, "confidence": confidence})
    return sorted(results, key=lambda item: item["confidence"], reverse=True)[:4]


def _derive_current_obsessions(title_refs: list[dict]) -> list[dict]:
    return [
        {
            "title_id": item.get("title_id"),
            "title_name": item.get("title_name", "Untitled"),
            "poster_url": item.get("poster_url"),
        }
        for item in title_refs[:4]
    ]


def _serialize_genres(genre_scores: dict[str, float]) -> list[dict]:
    if not genre_scores:
        return []
    top = sorted(genre_scores.items(), key=lambda item: item[1], reverse=True)[:4]
    max_score = top[0][1] or 1
    return [{"genre": genre, "score": int(round(score / max_score * 100))} for genre, score in top]


def _build_summary(top_genres: list[dict], themes: list[str], labels: list[dict]) -> str | None:
    if not top_genres and not labels:
        return None
    label_text = ", ".join(item["label"] for item in labels[:2])
    genre_text = ", ".join(item["genre"] for item in top_genres[:2])
    theme_text = ", ".join(themes[:2])
    if label_text and theme_text:
        return f"You gravitate toward {label_text.lower()} stories with {theme_text.lower()} energy."
    if genre_text and theme_text:
        return f"You keep coming back to {genre_text.lower()} with a strong pull toward {theme_text.lower()} storytelling."
    if label_text:
        return f"Your taste leans clearly toward {label_text.lower()}."
    return f"Your taste currently centers on {genre_text.lower()}."


def _signal_counts(db: Session, user_id: UUID) -> dict:
    return {
        "ratings": int(db.scalar(select(func.count(Rating.id)).where(Rating.user_id == user_id)) or 0),
        "reviews": int(db.scalar(select(func.count(Review.id)).where(Review.user_id == user_id)) or 0),
        "saves": int(
            db.scalar(
                select(func.count(WatchlistItem.id))
                .join(Watchlist, Watchlist.id == WatchlistItem.watchlist_id)
                .where(Watchlist.owner_user_id == user_id)
            )
            or 0
        ),
        "reactions": int(db.scalar(select(func.count(FeedReaction.id)).where(FeedReaction.user_id == user_id)) or 0),
        "comments": int(db.scalar(select(func.count(FeedComment.id)).where(FeedComment.user_id == user_id)) or 0),
        "swipes": int(db.scalar(select(func.count(SwipeRecord.id)).where(SwipeRecord.user_id == user_id)) or 0),
    }


def _refresh_wrapped_stat(db: Session, user_id: UUID, profile: UserTasteProfile) -> None:
    current_year = datetime.now(timezone.utc).year
    wrapped = db.scalar(select(WrappedStat).where(WrappedStat.user_id == user_id, WrappedStat.year == current_year))
    if wrapped is None:
        wrapped = WrappedStat(user_id=user_id, year=current_year)
        db.add(wrapped)
        db.flush()
    wrapped.top_genre = (profile.top_genres or [{}])[0].get("genre") if profile.top_genres else None
    wrapped.favorite_platform = (profile.top_platforms or [None])[0]
    wrapped.titles_saved = int(profile.signal_counts.get("saves", 0))
    wrapped.reactions_count = int(profile.signal_counts.get("reactions", 0))
    wrapped.top_label = (profile.taste_labels or [{}])[0].get("label") if profile.taste_labels else None
    wrapped.most_saved_title = (profile.current_obsessions or [{}])[0].get("title_name") if profile.current_obsessions else None
    wrapped.stats = {
        "top_themes": profile.top_themes or [],
        "favorite_eras": profile.favorite_eras or [],
        "profile_summary": profile.profile_summary,
    }
    wrapped.updated_at = datetime.now(timezone.utc)


def _is_stale(updated_at: datetime | None, *, hours: int) -> bool:
    if updated_at is None:
        return True
    return (datetime.now(timezone.utc) - updated_at).total_seconds() > hours * 3600


def _prune_old_swipes(db: Session, user_id: UUID, *, keep: int = 500) -> None:
    rows = db.scalars(
        select(SwipeRecord.id)
        .where(SwipeRecord.user_id == user_id)
        .order_by(SwipeRecord.created_at.desc())
        .offset(keep)
    ).all()
    if rows:
        db.execute(delete(SwipeRecord).where(SwipeRecord.id.in_(rows)))
