from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.content import ContentTitle
from app.models.social import (
    FeedComment,
    FeedEvent,
    FeedReaction,
    TeamActivity,
    Team,
    TeamMember,
    TeamRanking,
    TeamTitle,
    Watchlist,
    WatchlistItem,
)
from app.models.user import User, UserPreferences, UserProfile
from app.services.feed import create_feed_event

SEED_TAG = "demo_feed_v3"

USERS = [
    "Greg Wallace",
    "Erin Patel",
    "Chloe Bennett",
    "Lucas Reed",
    "Ava Martinez",
    "Ben Carter",
    "Maya Thompson",
    "Noah Kim",
    "SeenSnap Demo",
]

USER_IDS = {
    "user_greg": "Greg Wallace",
    "user_erin": "Erin Patel",
    "user_chloe": "Chloe Bennett",
    "user_lucas": "Lucas Reed",
    "user_ava": "Ava Martinez",
    "user_ben": "Ben Carter",
    "user_maya": "Maya Thompson",
    "user_noah": "Noah Kim",
    "user_demo": "SeenSnap Demo",
}

TITLES = {
    "oppenheimer": dict(tmdb_id=872585, content_type="movie", title="Oppenheimer", poster_path="/ptpr0kGAckfQkJeJIt8st5dglvd.jpg"),
    "topgun_maverick": dict(tmdb_id=361743, content_type="movie", title="Top Gun: Maverick", poster_path="/62HCnUTziyWcpDaBO2i1DX17ljH.jpg"),
    "last_of_us": dict(tmdb_id=100088, content_type="series", title="The Last of Us", poster_path="/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg"),
    "euphoria": dict(tmdb_id=85552, content_type="series", title="Euphoria", poster_path="/3Q0hd3heuWwDWpwcDkhQOA6TYWI.jpg"),
    "the_office": dict(tmdb_id=2316, content_type="series", title="The Office", poster_path="/qWnJzyZhyy74gjpSjIXWmuk0ifX.jpg"),
    "band_of_brothers": dict(tmdb_id=4613, content_type="series", title="Band of Brothers", poster_path="/4fapIev5f9X8H7f8qf2U9A8f9Yw.jpg"),
    "succession": dict(tmdb_id=76331, content_type="series", title="Succession", poster_path="/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg"),
    "severance": dict(tmdb_id=95396, content_type="series", title="Severance", poster_path="/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg"),
    "dune2": dict(tmdb_id=693134, content_type="movie", title="Dune: Part Two", poster_path="/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg"),
    "toy_story_2": dict(tmdb_id=863, content_type="movie", title="Toy Story 2", poster_path="/2MFIhZAW0CVfQ5JwJwM9k4r7Q9Q.jpg"),
    "national_treasure": dict(tmdb_id=2059, content_type="movie", title="National Treasure", poster_path="/yHDy8sZojfA6tM80iJ7dV3P6l4X.jpg"),
    "encanto": dict(tmdb_id=568124, content_type="movie", title="Encanto", poster_path="/4j0PNHkMr5ax3IA8tjtxcmPU3QT.jpg"),
    "arrival": dict(tmdb_id=329865, content_type="movie", title="Arrival", poster_path="/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg"),
    "blade_runner_2049": dict(tmdb_id=335984, content_type="movie", title="Blade Runner 2049", poster_path="/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg"),
    "interstellar": dict(tmdb_id=157336, content_type="movie", title="Interstellar", poster_path="/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"),
    "ex_machina": dict(tmdb_id=264660, content_type="movie", title="Ex Machina", poster_path="/dmJW8IAKHKxFNiUnoDR7JfsK7Rp.jpg"),
}


def _slug(name: str) -> str:
    return name.lower().replace(" ", ".")


def _avatar(index: int) -> str:
    avatar_ids = [11, 22, 33, 45, 57, 61, 66, 69, 71]
    return f"https://i.pravatar.cc/160?img={avatar_ids[(index - 1) % len(avatar_ids)]}"


def _upsert_user(db: Session, name: str, index: int) -> User:
    email = f"{_slug(name)}@demo.seensnap.local"
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None:
        user = User(email=email, auth_provider="demo")
        db.add(user)
        db.flush()

    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        profile = UserProfile(
            user_id=user.id,
            username=_slug(name)[:32],
            display_name=name,
            avatar_url=_avatar(index),
            favorite_genres=[],
            country_code="US",
        )
        db.add(profile)
    else:
        profile.display_name = name
        profile.avatar_url = _avatar(index)

    preferences = db.scalar(select(UserPreferences).where(UserPreferences.user_id == user.id))
    if preferences is None:
        db.add(UserPreferences(user_id=user.id))

    watchlist = db.scalar(select(Watchlist).where(Watchlist.owner_user_id == user.id, Watchlist.is_default.is_(True)))
    if watchlist is None:
        db.add(Watchlist(owner_user_id=user.id, name="My Picks", is_default=True))
    return user


def _upsert_title(db: Session, key: str) -> ContentTitle:
    info = TITLES[key]
    title = db.scalar(select(ContentTitle).where(ContentTitle.tmdb_id == info["tmdb_id"]))
    poster_url = f"https://image.tmdb.org/t/p/w500{info['poster_path']}"
    if title is None:
        title = ContentTitle(
            tmdb_id=info["tmdb_id"],
            content_type=info["content_type"],
            title=info["title"],
            original_title=info["title"],
            overview=info["title"],
            poster_url=poster_url,
            backdrop_url=poster_url,
            genres=[],
            metadata_raw={"seed_tag": SEED_TAG},
        )
        db.add(title)
        db.flush()
    else:
        title.poster_url = title.poster_url or poster_url
        title.backdrop_url = title.backdrop_url or poster_url
    return title


def _team_slug(value: str) -> str:
    return "-".join(part for part in "".join(ch.lower() if ch.isalnum() else "-" for ch in value).split("-") if part)


def _ensure_team(
    db: Session,
    owner: User,
    name: str,
    members: list[User],
    *,
    description: str,
    icon: str,
    visibility: str = "private",
) -> Team:
    slug = _team_slug(name)
    team = db.scalar(
        select(Team).where((Team.name == name) | (Team.slug == slug), Team.archived_at.is_(None))
    )
    if team is None:
        team = Team(
            name=name,
            slug=slug,
            description=description,
            visibility=visibility,
            icon=icon,
            owner_user_id=owner.id,
            invite_code=uuid4().hex[:8],
            max_members=10,
        )
        db.add(team)
        db.flush()
    else:
        team.name = name
        team.slug = slug
        team.description = description
        team.icon = icon
        team.visibility = visibility

    for user in members:
        membership = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user.id))
        role = "owner" if user.id == owner.id else "member"
        if membership is None:
            db.add(TeamMember(team_id=team.id, user_id=user.id, role=role, status="active"))
        else:
            membership.status = "active"
            membership.role = role
    return team


def _upsert_reactor_user(db: Session, index: int) -> User:
    email = f"fan{index:03d}@demo.seensnap.local"
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None:
        user = User(email=email, auth_provider="demo")
        db.add(user)
        db.flush()
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        db.add(
            UserProfile(
                user_id=user.id,
                username=f"fan{index:03d}",
                display_name=f"SeenSnap Fan {index:03d}",
                avatar_url=f"https://i.pravatar.cc/160?img={((index - 1) % 70) + 1}",
                favorite_genres=[],
                country_code="US",
            )
        )
    return user


def _add_reactions(db: Session, event: FeedEvent, counts: dict[str, int], reactor_users: list[User]) -> None:
    pool = iter(reactor_users)
    for reaction, count in counts.items():
        for _ in range(count):
            user = next(pool, None)
            if user is None:
                return
            db.add(FeedReaction(event_id=event.id, user_id=user.id, reaction=reaction))


def _add_comments(
    db: Session,
    event: FeedEvent,
    users: dict[str, User],
    comments: list[dict],
    target_count: int,
) -> None:
    inserted = 0
    for comment in comments:
        author = users[USER_IDS[comment["authorId"]]]
        root = FeedComment(event_id=event.id, user_id=author.id, body=comment["text"])
        db.add(root)
        db.flush()
        inserted += 1
        for reply in comment.get("replies", []):
            reply_user = users[USER_IDS[reply["authorId"]]]
            db.add(
                FeedComment(
                    event_id=event.id,
                    user_id=reply_user.id,
                    parent_comment_id=root.id,
                    body=reply["text"],
                )
            )
            inserted += 1

    filler_users = list(users.values())
    while inserted < target_count:
        user = filler_users[inserted % len(filler_users)]
        db.add(FeedComment(event_id=event.id, user_id=user.id, body=f"Great pick ({inserted + 1})."))
        inserted += 1


def seed_demo_feed() -> None:
    db = SessionLocal()
    try:
        db.execute(
            delete(FeedReaction).where(
                FeedReaction.event_id.in_(
                    select(FeedEvent.id).where(FeedEvent.payload["seed_tag"].astext.in_(["demo_feed_v1", "demo_feed_v2", SEED_TAG]))
                )
            )
        )
        db.execute(
            delete(FeedComment).where(
                FeedComment.event_id.in_(
                    select(FeedEvent.id).where(FeedEvent.payload["seed_tag"].astext.in_(["demo_feed_v1", "demo_feed_v2", SEED_TAG]))
                )
            )
        )
        db.execute(
            delete(FeedEvent).where(FeedEvent.payload["seed_tag"].astext.in_(["demo_feed_v1", "demo_feed_v2", SEED_TAG]))
        )
        db.commit()

        users = {name: _upsert_user(db, name, i + 1) for i, name in enumerate(USERS)}
        titles = {key: _upsert_title(db, key) for key in TITLES}
        reactors = [_upsert_reactor_user(db, i + 1) for i in range(140)]

        family_team = _ensure_team(
            db,
            users["Ava Martinez"],
            "#Family Watch Team",
            [users[n] for n in ["Ava Martinez", "Greg Wallace", "Chloe Bennett", "Ben Carter", "Lucas Reed"]],
            description="Comfort rewatches, heated rankings, and zero genre discipline.",
            icon="🍿",
        )
        friday_team = _ensure_team(
            db,
            users["Lucas Reed"],
            "#FridayNight Watch Team",
            [users[n] for n in ["Lucas Reed", "Maya Thompson", "Noah Kim", "Greg Wallace"]],
            description="Big swings, prestige picks, and something we can all argue about.",
            icon="🎬",
        )
        scifi_team = _ensure_team(
            db,
            users["Maya Thompson"],
            "#SciFi Club",
            [users[n] for n in ["Maya Thompson", "Noah Kim", "Erin Patel", "Lucas Reed"]],
            description="Time loops, dystopias, and people making terrible choices in space.",
            icon="🚀",
        )
        college_team = _ensure_team(
            db,
            users["Ben Carter"],
            "#College Friends Watch Team",
            [users[n] for n in ["Ben Carter", "Chloe Bennett", "Greg Wallace", "Ava Martinez"]],
            description="Nostalgia, chaos, and movies that should probably stay in 2009.",
            icon="🎓",
        )

        team_ids = [family_team.id, friday_team.id, scifi_team.id, college_team.id]
        db.execute(delete(TeamTitle).where(TeamTitle.team_id.in_(team_ids)))
        db.execute(delete(TeamRanking).where(TeamRanking.team_id.in_(team_ids)))
        db.execute(delete(TeamActivity).where(TeamActivity.team_id.in_(team_ids), TeamActivity.payload["seed_tag"].astext == SEED_TAG))

        team_title_seed = {
            family_team.id: ["the_office", "band_of_brothers", "toy_story_2", "national_treasure", "encanto"],
            friday_team.id: ["dune2", "oppenheimer", "topgun_maverick", "succession", "last_of_us"],
            scifi_team.id: ["severance", "arrival", "blade_runner_2049", "interstellar", "ex_machina"],
            college_team.id: ["national_treasure", "topgun_maverick", "toy_story_2", "the_office"],
        }

        for team_id, title_keys in team_title_seed.items():
            for idx, title_key in enumerate(title_keys, start=1):
                title = titles[title_key]
                db.add(
                    TeamTitle(
                        team_id=team_id,
                        content_title_id=title.id,
                        added_by_user_id=users["SeenSnap Demo"].id,
                        note="Seeded for watch team demo",
                    )
                )
                db.add(
                    TeamRanking(
                        team_id=team_id,
                        content_title_id=title.id,
                        rank=idx,
                        score=max(9.6 - (idx * 0.3), 7.1),
                        movement="up" if idx <= 2 else "same",
                        weeks_on_list=idx + 1,
                    )
                )

        now = datetime.now(UTC)

        events_data = [
            dict(id="post_greg_oppenheimer_rating", segment="for_you", event_type="rating", actor="Greg Wallace", title="oppenheimer", body="Cillian Murphy was unreal.", cta="Where to Watch", action_label="rated a movie", reactions={"fire": 29, "heart": 45, "thumbs_down": 0, "tomato": 0}, comments_count=13, comments=[dict(authorId="user_maya", text="The last hour is absolutely insane.", replies=[dict(authorId="user_noah", text="That score does so much work too.")]), dict(authorId="user_ben", text="I still can’t believe how tense a hearing scene was."), dict(authorId="user_chloe", text="Need a rewatch just for the visuals.")]),
            dict(id="post_chloe_topgun_poster", segment="for_you", event_type="poster_share", actor="Chloe Bennett", title="topgun_maverick", body="You in the cockpit. Obviously.", cta="View Poster", action_label="shared a poster", reactions={"fire": 33, "heart": 40, "thumbs_down": 0, "tomato": 0}, comments_count=8, comments=[dict(authorId="user_ava", text="This is aggressively on-brand."), dict(authorId="user_lucas", text="Honestly? Frame it.")]),
            dict(id="post_erin_euphoria_soundtrack", segment="for_you", event_type="soundtrack_activity", actor="Erin Patel", title="euphoria", body="Top streaming soundtrack this week. Labrinth stays undefeated.", cta="Listen Now", action_label="soundtrack activity", reactions={"fire": 18, "heart": 27, "thumbs_down": 1, "tomato": 0}, comments_count=5, comments=[dict(authorId="user_greg", text="I forgot how good this soundtrack is."), dict(authorId="user_chloe", text="This one absolutely owns late-night driving.")]),
            dict(id="post_lucas_lastofus_rec", segment="for_you", event_type="recommendation", actor="Lucas Reed", title="last_of_us", body="If you somehow skipped this, now is the time.", cta="See Details", action_label="recommended a title", reactions={"fire": 21, "heart": 31, "thumbs_down": 1, "tomato": 0}, comments_count=7, comments=[dict(authorId="user_maya", text="Episode 3 still hasn’t left my brain."), dict(authorId="user_noah", text="The production design alone is worth it.")]),
            dict(id="post_ben_office_discover", segment="for_you", event_type="community_pick", actor="SeenSnap Demo", title="the_office", body="SeenSnap’s #1 ranked comfort comedy this week.", cta="View Rankings", action_label="ranked comedy update", reactions={"fire": 6, "heart": 19, "thumbs_down": 3, "tomato": 1}, comments_count=4, comments=[dict(authorId="user_ben", text="Correct. No notes."), dict(authorId="user_ava", text="Parks and Rec is going to want a recount.")]),
            dict(id="post_team_family_watchlist", segment="watch_teams", event_type="watch_team_update", actor="SeenSnap Demo", title="the_office", team=family_team.id, body="Added to the family comfort-watch rotation.", cta="View Team Rankings", action_label="watchlist item added", reactions={"fire": 1, "heart": 0, "thumbs_down": 0, "tomato": 0}, comments_count=3, comments=[dict(authorId="user_ben", text="This was inevitable."), dict(authorId="user_chloe", text="Only if we agree to skip Scott’s Tots.")]),
            dict(id="post_ava_trivia", segment="watch_teams", event_type="quiz_result", actor="Ava Martinez", title=None, team=family_team.id, body="90% on 80s Movie Trivia. Everyone else, good luck.", cta="Play Quiz", action_label="scored 90% on trivia", reactions={"fire": 14, "heart": 7, "thumbs_down": 0, "tomato": 0}, comments_count=4, comments=[dict(authorId="user_lucas", text="I’m blaming the soundtrack questions."), dict(authorId="user_greg", text="Run it back.")]),
            dict(id="post_lucas_bandofbrothers_team", segment="watch_teams", event_type="recommendation", actor="Lucas Reed", title="band_of_brothers", team=friday_team.id, body="If we’re doing one prestige war series this month, it should be this.", cta="See Details", action_label="recommended to Watch Team", reactions={"fire": 17, "heart": 24, "thumbs_down": 0, "tomato": 0}, comments_count=6, comments=[dict(authorId="user_greg", text="This is one of those ‘watch it once and never forget it’ shows."), dict(authorId="user_maya", text="Putting this on the shortlist immediately.")]),
            dict(id="post_scifi_arrival_add", segment="watch_teams", event_type="watch_team_update", actor="Maya Thompson", title="arrival", team=scifi_team.id, body="Added Arrival to #SciFi Club tonight.", cta="See Details", action_label="watchlist item added", reactions={"fire": 10, "heart": 16, "thumbs_down": 0, "tomato": 0}, comments_count=3, comments=[dict(authorId="user_noah", text="Great pick. Villeneuve week?"), dict(authorId="user_erin", text="Yes please.")]),
            dict(id="post_scifi_severance_discussion", segment="watch_teams", event_type="team_post", actor="Noah Kim", title="severance", team=scifi_team.id, body="Anyone else think Lumon is still the best dystopian office world?", cta="Join Discussion", action_label="started a discussion", reactions={"fire": 12, "heart": 14, "thumbs_down": 1, "tomato": 0}, comments_count=4, comments=[dict(authorId="user_maya", text="Season 2 escalated perfectly."), dict(authorId="user_lucas", text="Completely agree.")]),
            dict(id="post_scifi_interstellar_soundtrack", segment="watch_teams", event_type="soundtrack_activity", actor="Erin Patel", title="interstellar", team=scifi_team.id, body="Shared the Interstellar soundtrack for this week’s watch.", cta="Listen Now", action_label="shared a soundtrack", reactions={"fire": 9, "heart": 15, "thumbs_down": 0, "tomato": 0}, comments_count=2, comments=[dict(authorId="user_maya", text="Docking scene music forever.")]),
            dict(id="post_discover_office_ranked", segment="discover", event_type="community_pick", actor="SeenSnap Demo", title="the_office", body="SeenSnap’s #1 ranked comedy.", cta="View Rankings", action_label="platform ranking", reactions={"fire": 0, "heart": 0, "thumbs_down": 1, "tomato": 0}, comments_count=2, comments=[dict(authorId="user_ben", text="This is exactly where it belongs.")]),
            dict(id="post_discover_euphoria_soundtrack", segment="discover", event_type="soundtrack_activity", actor="Erin Patel", title="euphoria", body="Top streaming soundtrack on SeenSnap today.", cta="Listen Now", action_label="top soundtrack trend", reactions={"fire": 12, "heart": 21, "thumbs_down": 0, "tomato": 0}, comments_count=3, comments=[dict(authorId="user_chloe", text="Every track on this thing feels expensive.")]),
            dict(id="post_discover_succession_wave", segment="discover", event_type="trending_now", actor="SeenSnap Demo", title="succession", body="3 of your friends are watching this right now.", cta="See Why", action_label="trending now", reactions={"fire": 19, "heart": 23, "thumbs_down": 0, "tomato": 0}, comments_count=4, comments=[dict(authorId="user_greg", text="This show gets funnier every time someone loses their mind in a boardroom.")]),
            dict(id="post_discover_severance_pick", segment="discover", event_type="recommended_title", actor="SeenSnap Demo", title="severance", body="Because you liked Succession and The Last of Us.", cta="See Details", action_label="recommended for you", reactions={"fire": 11, "heart": 19, "thumbs_down": 0, "tomato": 0}, comments_count=3, comments=[dict(authorId="user_maya", text="Absolutely yes if you want corporate dread as a genre.")]),
        ]

        for i, row in enumerate(events_data):
            actor = users[row["actor"]]
            title = titles[row["title"]] if row.get("title") else None
            event = create_feed_event(
                db,
                actor_user_id=actor.id,
                team_id=row.get("team"),
                content_title_id=title.id if title else None,
                event_type=row["event_type"],
                source_type="demo_seed",
                source_id=None,
                payload={
                    "seed_tag": SEED_TAG,
                    "segment": row["segment"],
                    "body": row["body"],
                    "cta": row["cta"],
                    "action_label": row["action_label"],
                    "post_id": row["id"],
                },
            )
            event.created_at = now - timedelta(minutes=(len(events_data) - i) * 52)
            _add_reactions(db, event, row["reactions"], reactors)
            _add_comments(db, event, users, row["comments"], row["comments_count"])

        watchlist = db.scalar(select(Watchlist).where(Watchlist.owner_user_id == users["Greg Wallace"].id, Watchlist.is_default.is_(True)))
        if watchlist:
            for key in ["severance", "succession", "last_of_us"]:
                title = titles[key]
                exists = db.scalar(select(WatchlistItem).where(WatchlistItem.watchlist_id == watchlist.id, WatchlistItem.content_title_id == title.id))
                if exists is None:
                    db.add(WatchlistItem(watchlist_id=watchlist.id, content_title_id=title.id, added_via="demo_seed"))

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_feed()
