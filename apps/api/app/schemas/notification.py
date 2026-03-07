from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    notification_type: str
    title: str
    body: str
    read_at: datetime | None = None
    created_at: datetime

