from uuid import uuid4

from fastapi import APIRouter, status

from app.schemas.team import TeamCreateRequest, TeamResponse

router = APIRouter()

_TEAM_STORE: list[TeamResponse] = []


@router.get("", response_model=list[TeamResponse])
def list_teams() -> list[TeamResponse]:
    return _TEAM_STORE


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(payload: TeamCreateRequest) -> TeamResponse:
    team = TeamResponse(
        id=uuid4(),
        name=payload.name,
        owner_user_id=payload.owner_user_id,
        invite_code=uuid4().hex[:8],
        max_members=payload.max_members,
    )
    _TEAM_STORE.append(team)
    return team

