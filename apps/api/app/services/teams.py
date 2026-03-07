from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.models.social import Team, TeamMember
from app.models.user import User, UserProfile
from app.schemas.team import TeamCreateRequest
from app.services.activity import log_team_activity


def _invite_code() -> str:
    return uuid4().hex[:8]


def get_team(db: Session, team_id: UUID) -> Team | None:
    return db.scalar(select(Team).where(Team.id == team_id, Team.archived_at.is_(None)))


def require_team_member(db: Session, team_id: UUID, user_id: UUID) -> Team:
    team = get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    membership = db.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
            TeamMember.status == "active",
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Team membership required")
    return team


def list_user_teams(db: Session, user_id: UUID) -> list[tuple[Team, int]]:
    membership_filter = aliased(TeamMember)
    active_members = aliased(TeamMember)
    rows = db.execute(
        select(Team, func.count(active_members.id).label("member_count"))
        .join(membership_filter, membership_filter.team_id == Team.id)
        .join(active_members, active_members.team_id == Team.id)
        .where(
            membership_filter.user_id == user_id,
            membership_filter.status == "active",
            active_members.status == "active",
            Team.archived_at.is_(None),
        )
        .group_by(Team.id)
        .order_by(Team.created_at.desc())
    ).all()
    return [(team, member_count) for team, member_count in rows]


def list_team_members(db: Session, team_id: UUID) -> list[TeamMember]:
    return db.scalars(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.joined_at.asc())
    ).all()


def list_team_member_profiles(db: Session, team_id: UUID) -> dict[UUID, UserProfile]:
    rows = db.scalars(
        select(UserProfile)
        .join(TeamMember, TeamMember.user_id == UserProfile.user_id)
        .where(TeamMember.team_id == team_id)
    ).all()
    return {profile.user_id: profile for profile in rows}


def create_team(db: Session, current_user: User, payload: TeamCreateRequest) -> Team:
    team = Team(
        name=payload.name.strip(),
        owner_user_id=current_user.id,
        invite_code=_invite_code(),
        max_members=payload.max_members,
    )
    db.add(team)
    db.flush()

    db.add(
        TeamMember(
            team_id=team.id,
            user_id=current_user.id,
            role="owner",
            status="active",
        )
    )
    log_team_activity(
        db,
        team_id=team.id,
        actor_user_id=current_user.id,
        activity_type="team_created",
        entity_id=team.id,
        payload={"team_name": team.name},
    )
    db.commit()
    db.refresh(team)
    return team


def join_team_by_invite_code(db: Session, current_user: User, invite_code: str) -> Team:
    normalized_code = invite_code.strip().lower()
    team = db.scalar(select(Team).where(func.lower(Team.invite_code) == normalized_code, Team.archived_at.is_(None)))
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite code not found")

    membership = db.scalar(
        select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == current_user.id)
    )
    if membership is not None:
        if membership.status != "active":
            membership.status = "active"
            db.commit()
        return team

    member_count = db.scalar(
        select(func.count(TeamMember.id)).where(TeamMember.team_id == team.id, TeamMember.status == "active")
    )
    if member_count is not None and member_count >= team.max_members:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Team is full")

    db.add(
        TeamMember(
            team_id=team.id,
            user_id=current_user.id,
            role="member",
            status="active",
        )
    )
    log_team_activity(
        db,
        team_id=team.id,
        actor_user_id=current_user.id,
        activity_type="member_joined",
        payload={"joined_user_id": str(current_user.id)},
    )
    db.commit()
    db.refresh(team)
    return team


def get_team_member(db: Session, team_id: UUID, user_id: UUID) -> TeamMember | None:
    return db.scalar(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id))


def leave_team(db: Session, current_user: User, team_id: UUID) -> Team:
    team = require_team_member(db, team_id, current_user.id)
    membership = get_team_member(db, team_id, current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team membership not found")

    membership.status = "left"
    previous_role = membership.role
    membership.role = "member"

    active_members = db.scalars(
        select(TeamMember)
        .where(TeamMember.team_id == team_id, TeamMember.user_id != current_user.id, TeamMember.status == "active")
        .order_by(TeamMember.joined_at.asc())
    ).all()

    log_team_activity(
        db,
        team_id=team.id,
        actor_user_id=current_user.id,
        activity_type="member_left",
        payload={"left_user_id": str(current_user.id)},
    )

    if previous_role == "owner":
        if active_members:
            new_owner = active_members[0]
            new_owner.role = "owner"
            team.owner_user_id = new_owner.user_id
            log_team_activity(
                db,
                team_id=team.id,
                actor_user_id=new_owner.user_id,
                activity_type="ownership_transferred",
                payload={"previous_owner_user_id": str(current_user.id)},
            )
        else:
            team.archived_at = datetime.now(UTC)
            log_team_activity(
                db,
                team_id=team.id,
                actor_user_id=current_user.id,
                activity_type="team_archived",
                payload={"reason": "owner_left"},
            )

    db.commit()
    db.refresh(team)
    return team


def remove_team_member(db: Session, current_user: User, team_id: UUID, member_user_id: UUID) -> Team:
    team = require_team_member(db, team_id, current_user.id)
    requester_membership = get_team_member(db, team_id, current_user.id)
    if requester_membership is None or requester_membership.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can manage members")

    if team.owner_user_id == member_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner cannot be removed")

    membership = get_team_member(db, team_id, member_user_id)
    if membership is None or membership.status != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    membership.status = "removed"
    membership.role = "member"
    log_team_activity(
        db,
        team_id=team.id,
        actor_user_id=current_user.id,
        activity_type="member_removed",
        payload={"removed_user_id": str(member_user_id)},
    )
    db.commit()
    db.refresh(team)
    return team
