from fastapi import APIRouter

from app.api.routes import auth, feed, me, notifications, shares, snips, teams, titles, watchlist

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(me.router, prefix="/me", tags=["me"])
api_router.include_router(titles.router, prefix="/titles", tags=["titles"])
api_router.include_router(watchlist.router, prefix="/me/watchlist", tags=["watchlist"])
api_router.include_router(feed.router, prefix="/feed", tags=["feed"])
api_router.include_router(snips.router, prefix="/snips", tags=["snips"])
api_router.include_router(teams.router, prefix="/teams", tags=["teams"])
api_router.include_router(shares.router, prefix="/shares", tags=["shares"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
