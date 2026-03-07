from uuid import UUID

from fastapi import APIRouter

from app.schemas.content import StreamingOptionResponse, TitleResponse

router = APIRouter()


@router.get("/search", response_model=list[TitleResponse])
def search_titles(q: str) -> list[TitleResponse]:
    if not q.strip():
        return []

    return [
        TitleResponse(
            id=UUID("00000000-0000-0000-0000-000000000101"),
            tmdb_id=1396,
            content_type="series",
            title="Breaking Bad",
            overview="A chemistry teacher turned meth producer navigates escalating risk.",
            poster_url=None,
            genres=["Drama", "Crime"],
        )
    ]


@router.get("/{title_id}", response_model=TitleResponse)
def get_title(title_id: UUID) -> TitleResponse:
    return TitleResponse(
        id=title_id,
        tmdb_id=1396,
        content_type="series",
        title="Breaking Bad",
        overview="A chemistry teacher turned meth producer navigates escalating risk.",
        poster_url=None,
        genres=["Drama", "Crime"],
    )


@router.get("/{title_id}/streaming-options", response_model=list[StreamingOptionResponse])
def get_streaming_options(title_id: UUID) -> list[StreamingOptionResponse]:
    return [
        StreamingOptionResponse(
            provider_code="netflix",
            provider_name="Netflix",
            region_code="US",
            deeplink_url=f"https://www.netflix.com/title/{title_id}",
            web_url=f"https://www.netflix.com/title/{title_id}",
            is_connected_priority=False,
        )
    ]

