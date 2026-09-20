from sqlalchemy.orm import Session

from app.models.hotel_settings import HotelSettings
from app.schemas.settings import HotelSettingsUpdate


def get_settings(db: Session) -> HotelSettings:
    row = db.get(HotelSettings, 1)
    if row is None:
        row = HotelSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def update_settings(db: Session, payload: HotelSettingsUpdate) -> HotelSettings:
    row = get_settings(db)
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row
