from fastapi import APIRouter

from app.api.routes import auth, me, notifications, snips, teams, titles

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(me.router, prefix="/me", tags=["me"])
api_router.include_router(titles.router, prefix="/titles", tags=["titles"])
api_router.include_router(snips.router, prefix="/snips", tags=["snips"])
api_router.include_router(teams.router, prefix="/teams", tags=["teams"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
