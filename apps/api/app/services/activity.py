from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.social import TeamActivity
from app.models.user import UserProfile


def log_team_activity(
    db: Session,
    *,
    team_id,
    actor_user_id,
    activity_type: str,
    content_title_id=None,
    entity_id=None,
    payload: dict | None = None,
) -> TeamActivity:
    activity = TeamActivity(
        team_id=team_id,
        actor_user_id=actor_user_id,
        activity_type=activity_type,
        content_title_id=content_title_id,
        entity_id=entity_id,
        payload=payload or {},
    )
    db.add(activity)
    db.flush()
    return activity


def list_team_activity(db: Session, team_id) -> list[TeamActivity]:
    return db.scalars(
        select(TeamActivity)
        .where(TeamActivity.team_id == team_id)
        .order_by(TeamActivity.created_at.desc())
    ).all()


def list_activity_actor_profiles(db: Session, activities: list[TeamActivity]) -> dict:
    actor_ids = {activity.actor_user_id for activity in activities}
    if not actor_ids:
        return {}

    profiles = db.scalars(select(UserProfile).where(UserProfile.user_id.in_(actor_ids))).all()
    return {profile.user_id: profile for profile in profiles}
