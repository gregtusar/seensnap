from fastapi import APIRouter, HTTPException, status

from app.db.session import SessionLocal
from app.schemas.auth import GoogleAuthRequest, SessionResponse
from app.services.auth import GoogleAuthError, authenticate_with_google

router = APIRouter()


@router.post("/google", response_model=SessionResponse, status_code=status.HTTP_200_OK)
def google_auth(payload: GoogleAuthRequest) -> SessionResponse:
    db = SessionLocal()
    try:
        return authenticate_with_google(db, payload.id_token)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    finally:
        db.close()

