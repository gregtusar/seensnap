from fastapi import APIRouter

from app.schemas.notification import NotificationResponse

router = APIRouter()


@router.get("", response_model=list[NotificationResponse])
def list_notifications() -> list[NotificationResponse]:
    return []

