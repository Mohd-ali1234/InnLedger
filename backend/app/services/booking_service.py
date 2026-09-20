from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking
from app.models.enums import BookingStatus, RoomStatus
from app.models.room import Room
from app.schemas.booking import BookingCreate, BookingUpdate
from app.services.settings_service import get_settings

# Statuses that occupy a room's calendar and must not overlap.
BLOCKING_STATUSES = (BookingStatus.confirmed, BookingStatus.checked_in)


def _base_query(db: Session):
    return db.query(Booking).options(joinedload(Booking.room))


def list_bookings(db: Session) -> list[Booking]:
    return _base_query(db).order_by(Booking.created_at.desc()).all()


def get_booking(db: Session, booking_id: int) -> Booking:
    booking = _base_query(db).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


def _get_room_or_404(db: Session, room_id: int) -> Room:
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


def _check_overlap(
    db: Session, room_id: int, check_in: date, check_out: date, exclude_id: int | None = None
) -> None:
    """Reject bookings whose date range overlaps an existing blocking booking on the same room."""
    query = db.query(Booking).filter(
        Booking.room_id == room_id,
        Booking.status.in_(BLOCKING_STATUSES),
        # Overlap when an existing booking starts before the new one ends
        # and ends after the new one starts.
        Booking.check_in < check_out,
        Booking.check_out > check_in,
    )
    if exclude_id is not None:
        query = query.filter(Booking.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This room is already booked for the selected dates",
        )


def _validate_capacity(room: Room, guest_count: int) -> None:
    if guest_count > room.capacity:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Guest count ({guest_count}) exceeds room capacity ({room.capacity})",
        )


def _validate_discount(rate: float, discount: float, check_in: date, check_out: date) -> None:
    if discount > rate * (check_out - check_in).days:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Discount cannot exceed the room amount",
        )


def create_booking(db: Session, payload: BookingCreate) -> Booking:
    room = _get_room_or_404(db, payload.room_id)

    if room.status == RoomStatus.maintenance:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Room is under maintenance and cannot be booked",
        )

    _validate_capacity(room, payload.guest_count)
    if payload.status in BLOCKING_STATUSES:
        _check_overlap(db, payload.room_id, payload.check_in, payload.check_out)

    data = payload.model_dump()
    if data["rate"] is None:
        data["rate"] = room.price
    _validate_discount(data["rate"], data["discount"], payload.check_in, payload.check_out)

    hotel = get_settings(db)
    booking = Booking(
        **data, cgst_percent=hotel.cgst_percent, sgst_percent=hotel.sgst_percent
    )
    db.add(booking)

    # Checking a guest in immediately occupies the room.
    if booking.status == BookingStatus.checked_in:
        room.status = RoomStatus.occupied

    db.commit()
    return get_booking(db, booking.id)


def update_booking(db: Session, booking_id: int, payload: BookingUpdate) -> Booking:
    booking = get_booking(db, booking_id)
    data = payload.model_dump(exclude_unset=True)

    previous_status = booking.status
    room_id = data.get("room_id", booking.room_id)
    check_in = data.get("check_in", booking.check_in)
    check_out = data.get("check_out", booking.check_out)
    guest_count = data.get("guest_count", booking.guest_count)
    new_status = data.get("status", booking.status)

    if check_out <= check_in:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Check-out date must be after check-in date",
        )

    room = _get_room_or_404(db, room_id)
    _validate_capacity(room, guest_count)

    if new_status in BLOCKING_STATUSES:
        _check_overlap(db, room_id, check_in, check_out, exclude_id=booking_id)

    # Fields that are NOT NULL in the DB can't be cleared by an explicit null.
    for key in ("check_in_time", "check_out_time", "payment_method", "discount"):
        if key in data and data[key] is None:
            del data[key]

    _validate_discount(
        data.get("rate") if data.get("rate") is not None else booking.effective_rate,
        data.get("discount", booking.discount),
        check_in,
        check_out,
    )

    for field, value in data.items():
        setattr(booking, field, value)

    _apply_status_side_effects(db, booking, previous_status, new_status)

    db.commit()
    return get_booking(db, booking.id)


def cancel_booking(db: Session, booking_id: int) -> Booking:
    """Soft-cancel a booking (kept for history) and free the room if it was occupied."""
    booking = get_booking(db, booking_id)
    previous_status = booking.status
    booking.status = BookingStatus.cancelled
    _apply_status_side_effects(db, booking, previous_status, BookingStatus.cancelled)
    db.commit()
    return get_booking(db, booking.id)


def delete_booking(db: Session, booking_id: int) -> None:
    booking = get_booking(db, booking_id)
    # Free the room if this booking currently occupies it.
    if booking.status == BookingStatus.checked_in and booking.room.status == RoomStatus.occupied:
        booking.room.status = RoomStatus.available
    db.delete(booking)
    db.commit()


def _apply_status_side_effects(
    db: Session, booking: Booking, previous: BookingStatus, new: BookingStatus
) -> None:
    """Keep room status in sync with booking transitions (check-in -> occupied, etc.)."""
    if previous == new:
        return

    room = db.get(Room, booking.room_id)
    if room is None:
        return

    if new == BookingStatus.checked_in:
        room.status = RoomStatus.occupied
    elif previous == BookingStatus.checked_in and new in (
        BookingStatus.checked_out,
        BookingStatus.cancelled,
    ):
        # Guest left or booking voided — release the room unless flagged for maintenance.
        if room.status == RoomStatus.occupied:
            room.status = RoomStatus.available
