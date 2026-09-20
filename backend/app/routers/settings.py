from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database.session import get_db
from app.schemas.settings import HotelSettingsOut, HotelSettingsUpdate
from app.services import settings_service

router = APIRouter(
    prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_admin)]
)


@router.get("", response_model=HotelSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return settings_service.get_settings(db)


@router.put("", response_model=HotelSettingsOut)
def update_settings(payload: HotelSettingsUpdate, db: Session = Depends(get_db)):
    return settings_service.update_settings(db, payload)
