from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.api.dependencies import CurrentUser, DbSession
from app.models.social import TeamActivity
from app.models.social import Team as TeamModel
from app.models.social import TeamMember
from app.models.user import UserProfile
from app.schemas.team import (
    TeamActivityResponse,
    TeamCreateRequest,
    TeamJoinRequest,
    TeamMemberSummaryResponse,
    TeamResponse,
    TeamSummaryResponse,
)
from app.services.activity import list_activity_actor_profiles, list_team_activity
from app.services.teams import (
    create_team as create_team_record,
    get_team,
    join_team_by_invite_code,
    leave_team,
    list_team_member_profiles,
    list_team_members,
    list_user_teams,
    remove_team_member,
    require_team_member,
)

router = APIRouter()


@router.get("", response_model=list[TeamSummaryResponse])
def list_teams(current_user: CurrentUser, db: DbSession) -> list[TeamSummaryResponse]:
    return [_to_team_summary(team, member_count) for team, member_count in list_user_teams(db, current_user.id)]


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(payload: TeamCreateRequest, current_user: CurrentUser, db: DbSession) -> TeamResponse:
    team = create_team_record(db, current_user, payload)
    return _load_team_response(db, team)


@router.post("/join", response_model=TeamResponse, status_code=status.HTTP_200_OK)
def join_team(payload: TeamJoinRequest, current_user: CurrentUser, db: DbSession) -> TeamResponse:
    team = join_team_by_invite_code(db, current_user, payload.invite_code)
    return _load_team_response(db, team)


@router.get("/{team_id}", response_model=TeamResponse)
def get_team_detail(team_id: UUID, current_user: CurrentUser, db: DbSession) -> TeamResponse:
    require_team_member(db, team_id, current_user.id)
    team = get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return _load_team_response(db, team)


@router.get("/{team_id}/activity", response_model=list[TeamActivityResponse])
def get_team_activity(team_id: UUID, current_user: CurrentUser, db: DbSession) -> list[TeamActivityResponse]:
    require_team_member(db, team_id, current_user.id)
    activities = list_team_activity(db, team_id)
    actor_profiles = list_activity_actor_profiles(db, activities)
    return [_to_activity_response(activity, actor_profiles.get(activity.actor_user_id)) for activity in activities]


@router.post("/{team_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_team_route(team_id: UUID, current_user: CurrentUser, db: DbSession) -> Response:
    leave_team(db, current_user, team_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{team_id}/members/{member_user_id}", response_model=TeamResponse)
def remove_member_from_team(
    team_id: UUID,
    member_user_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> TeamResponse:
    team = remove_team_member(db, current_user, team_id, member_user_id)
    return _load_team_response(db, team)


def _load_team_response(db: DbSession, team: TeamModel) -> TeamResponse:
    members = list_team_members(db, team.id)
    profiles = list_team_member_profiles(db, team.id)
    return _to_team_response(team, members, profiles)


def _to_team_summary(team: TeamModel, member_count: int) -> TeamSummaryResponse:
    return TeamSummaryResponse(
        id=team.id,
        name=team.name,
        owner_user_id=team.owner_user_id,
        invite_code=team.invite_code,
        max_members=team.max_members,
        member_count=member_count,
    )


def _to_team_response(
    team: TeamModel,
    members: list[TeamMember],
    profiles: dict[UUID, UserProfile],
) -> TeamResponse:
    return TeamResponse(
        **_to_team_summary(team, len([member for member in members if member.status == "active"])).model_dump(),
        members=[
            TeamMemberSummaryResponse(
                user_id=member.user_id,
                display_name=profiles.get(member.user_id).display_name if profiles.get(member.user_id) else None,
                avatar_url=profiles.get(member.user_id).avatar_url if profiles.get(member.user_id) else None,
                role=member.role,
                status=member.status,
                joined_at=member.joined_at,
            )
            for member in members
        ],
    )


def _to_activity_response(activity: TeamActivity, actor_profile: UserProfile | None) -> TeamActivityResponse:
    return TeamActivityResponse(
        id=activity.id,
        activity_type=activity.activity_type,
        actor_user_id=activity.actor_user_id,
        actor_display_name=actor_profile.display_name if actor_profile is not None else None,
        actor_avatar_url=actor_profile.avatar_url if actor_profile is not None else None,
        content_title_id=activity.content_title_id,
        entity_id=activity.entity_id,
        payload=activity.payload,
        created_at=activity.created_at,
    )
