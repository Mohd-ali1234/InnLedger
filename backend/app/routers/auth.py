from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database.session import get_db
from app.models.admin import Admin
from app.schemas.auth import AdminOut, LoginRequest, Token
from app.services.auth_service import authenticate

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    access_token = authenticate(db, payload.username, payload.password)
    return Token(access_token=access_token)


@router.get("/me", response_model=AdminOut)
def me(current_admin: Admin = Depends(get_current_admin)) -> Admin:
    return current_admin
