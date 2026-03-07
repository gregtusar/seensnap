from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status

from app.schemas.snip import (
    SnipCreateRequest,
    SnipCreateResponse,
    SnipMatchRequest,
    SnipResponse,
)

router = APIRouter()

_SNIP_STORE: dict[UUID, SnipResponse] = {}


@router.post("", response_model=SnipCreateResponse, status_code=status.HTTP_201_CREATED)
def create_snip(payload: SnipCreateRequest) -> SnipCreateResponse:
    snip_id = uuid4()
    _SNIP_STORE[snip_id] = SnipResponse(
        id=snip_id,
        user_id=payload.user_id,
        content_title_id=None,
        image_url=payload.image_url,
        match_status="pending",
        match_confidence=None,
        capture_source=payload.capture_source,
    )
    return SnipCreateResponse(id=snip_id, status="pending")


@router.get("/{snip_id}", response_model=SnipResponse)
def get_snip(snip_id: UUID) -> SnipResponse:
    snip = _SNIP_STORE.get(snip_id)
    if snip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snip not found")
    return snip


@router.post("/{snip_id}/match", response_model=SnipResponse)
def match_snip(snip_id: UUID, payload: SnipMatchRequest) -> SnipResponse:
    snip = _SNIP_STORE.get(snip_id)
    if snip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snip not found")

    updated = snip.model_copy(
        update={
            "content_title_id": payload.selected_title_id,
            "match_status": "matched" if payload.selected_title_id else "failed",
            "match_confidence": 0.65 if payload.selected_title_id else 0.0,
        }
    )
    _SNIP_STORE[snip_id] = updated
    return updated

