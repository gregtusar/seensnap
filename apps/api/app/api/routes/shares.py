from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, DbSession
from app.schemas.share import TeamShareCreateRequest, TeamShareResponse
from app.services.shares import share_title_to_team

router = APIRouter()


@router.post("/teams/{team_id}", response_model=TeamShareResponse, status_code=status.HTTP_201_CREATED)
def create_team_share(
    team_id: UUID,
    payload: TeamShareCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> TeamShareResponse:
    share = share_title_to_team(db, current_user, team_id, payload.content_title_id)
    return TeamShareResponse(
        id=share.id,
        user_id=share.user_id,
        content_title_id=share.content_title_id,
        team_id=share.team_id,
        target=share.target,
        shared_at=share.shared_at,
    )
