from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.enums import BookingStatus, RoomStatus
from app.models.booking import Booking
from app.models.room import Room
from app.schemas.room import RoomCreate, RoomUpdate


def list_rooms(db: Session) -> list[Room]:
    return db.query(Room).order_by(Room.room_number).all()


def get_room(db: Session, room_id: int) -> Room:
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


def _ensure_unique_number(db: Session, room_number: str, exclude_id: int | None = None) -> None:
    query = db.query(Room).filter(Room.room_number == room_number)
    if exclude_id is not None:
        query = query.filter(Room.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Room number '{room_number}' already exists",
        )


def create_room(db: Session, payload: RoomCreate) -> Room:
    _ensure_unique_number(db, payload.room_number)
    room = Room(**payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def update_room(db: Session, room_id: int, payload: RoomUpdate) -> Room:
    room = get_room(db, room_id)
    data = payload.model_dump(exclude_unset=True)

    if "room_number" in data:
        _ensure_unique_number(db, data["room_number"], exclude_id=room_id)

    for field, value in data.items():
        setattr(room, field, value)

    db.commit()
    db.refresh(room)
    return room


def delete_room(db: Session, room_id: int) -> None:
    room = get_room(db, room_id)
    active = (
        db.query(Booking)
        .filter(
            Booking.room_id == room_id,
            Booking.status.in_([BookingStatus.confirmed, BookingStatus.checked_in]),
        )
        .first()
    )
    if active is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a room with active bookings",
        )
    db.delete(room)
    db.commit()


def available_rooms(db: Session) -> list[Room]:
    """Rooms that can currently accept new bookings (not under maintenance)."""
    return (
        db.query(Room)
        .filter(Room.status != RoomStatus.maintenance)
        .order_by(Room.room_number)
        .all()
    )
