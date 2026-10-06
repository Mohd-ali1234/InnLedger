from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking
from app.models.booking_room import BookingRoom
from app.models.enums import BookingStatus, RoomStatus
from app.models.room import Room
from app.schemas.booking import BookingCreate, BookingUpdate, CheckoutRequest
from app.services.settings_service import get_settings

# Statuses that occupy a room's calendar and must not overlap.
BLOCKING_STATUSES = (BookingStatus.confirmed, BookingStatus.checked_in)

_FAR_FUTURE = date(9999, 12, 31)


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
    db: Session,
    room_ids: list[int],
    check_in: date,
    check_out: date | None,
    exclude_id: int | None = None,
) -> None:
    """Reject stays that overlap an existing blocking booking on any of the rooms.

    A stay with no check-out yet is open-ended, so it blocks the room from its
    check-in date until the guest actually leaves.
    """
    new_end = check_out or _FAR_FUTURE
    query = (
        db.query(BookingRoom.room_id)
        .join(Booking, Booking.id == BookingRoom.booking_id)
        .filter(
            BookingRoom.room_id.in_(room_ids),
            Booking.status.in_(BLOCKING_STATUSES),
            Booking.check_in < new_end,
            or_(Booking.check_out.is_(None), Booking.check_out > check_in),
        )
    )
    if exclude_id is not None:
        query = query.filter(Booking.id != exclude_id)
    clash = query.first()
    if clash is not None:
        room = db.get(Room, clash[0])
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Room {room.room_number} is already booked for the selected dates",
        )


def _validate_capacity(rooms: list[Room], guest_count: int) -> None:
    capacity = sum(r.capacity for r in rooms)
    if guest_count > capacity:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Guest count ({guest_count}) exceeds the selected rooms' capacity ({capacity})",
        )


def _validate_discount(nightly_total: float, discount: float, check_in: date, check_out: date | None) -> None:
    """The discount can only be judged once the stay length is known (i.e. at check-out)."""
    if check_out is None:
        return
    nights = max(1, (check_out - check_in).days)
    if discount > nightly_total * nights:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Discount cannot exceed the room amount",
        )


def _validate_times(check_in: date, check_in_time: str, check_out: date | None, check_out_time: str) -> None:
    if check_out is not None and check_out == check_in and check_out_time <= check_in_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Check-out time must be after check-in time on the same day",
        )


def _load_bookable_rooms(db: Session, room_ids: list[int], allow: set[int] = frozenset()) -> list[Room]:
    rooms = [_get_room_or_404(db, i) for i in room_ids]
    for room in rooms:
        if room.status == RoomStatus.maintenance and room.id not in allow:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Room {room.room_number} is under maintenance and cannot be booked",
            )
    return rooms


def create_booking(db: Session, payload: BookingCreate) -> Booking:
    room_ids = [r.room_id for r in payload.rooms]
    rooms = _load_bookable_rooms(db, room_ids)

    _validate_capacity(rooms, payload.guest_count)
    _validate_times(payload.check_in, payload.check_in_time, payload.check_out, payload.check_out_time)
    if payload.status in BLOCKING_STATUSES:
        _check_overlap(db, room_ids, payload.check_in, payload.check_out)

    nightly_total = sum(r.rate for r in payload.rooms)
    _validate_discount(nightly_total, payload.discount, payload.check_in, payload.check_out)

    hotel = get_settings(db)
    booking = Booking(
        **payload.model_dump(exclude={"rooms", "services"}),
        **{f"svc_{k}": v for k, v in payload.services.model_dump().items()},
        # `room_id` / `rate` keep pointing at the first room for older code paths.
        room_id=room_ids[0],
        rate=payload.rooms[0].rate,
        cgst_percent=hotel.cgst_percent,
        sgst_percent=hotel.sgst_percent,
    )
    booking.rooms = [BookingRoom(room_id=r.room_id, rate=r.rate) for r in payload.rooms]
    db.add(booking)

    # Checking a guest in immediately occupies the rooms.
    if booking.status == BookingStatus.checked_in:
        for room in rooms:
            room.status = RoomStatus.occupied

    db.commit()
    return get_booking(db, booking.id)


def update_booking(db: Session, booking_id: int, payload: BookingUpdate) -> Booking:
    booking = get_booking(db, booking_id)
    data = payload.model_dump(exclude_unset=True)

    previous_status = booking.status
    old_room_ids = [r.room_id for r in booking.rooms]
    new_rooms = data.pop("rooms", None)
    services = data.pop("services", None) or {}
    room_ids = [r["room_id"] for r in new_rooms] if new_rooms else old_room_ids
    check_in = data.get("check_in", booking.check_in)
    check_out = data["check_out"] if "check_out" in data else booking.check_out
    guest_count = data.get("guest_count", booking.guest_count)
    new_status = data.get("status", booking.status)

    # Fields that are NOT NULL in the DB can't be cleared by an explicit null.
    for key in ("check_in_time", "check_out_time", "payment_method", "discount", "guest_count"):
        if key in data and data[key] is None:
            del data[key]

    if check_out is not None and check_out < check_in:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Check-out date cannot be before check-in date",
        )
    _validate_times(
        check_in,
        data.get("check_in_time", booking.check_in_time),
        check_out,
        data.get("check_out_time", booking.check_out_time),
    )

    # Rooms already on this booking stay selectable even if now flagged for maintenance.
    rooms = _load_bookable_rooms(db, room_ids, allow=set(old_room_ids))
    _validate_capacity(rooms, guest_count)

    if new_status in BLOCKING_STATUSES:
        _check_overlap(db, room_ids, check_in, check_out, exclude_id=booking_id)

    nightly_total = sum(r["rate"] for r in new_rooms) if new_rooms else booking.effective_rate
    _validate_discount(nightly_total, data.get("discount", booking.discount), check_in, check_out)

    for field, value in data.items():
        setattr(booking, field, value)
    for key, value in services.items():
        setattr(booking, f"svc_{key}", value)
    if new_rooms:
        booking.rooms = [BookingRoom(room_id=r["room_id"], rate=r["rate"]) for r in new_rooms]
        booking.room_id = room_ids[0]
        booking.rate = new_rooms[0]["rate"]

    _sync_room_status(db, booking, previous_status, new_status, old_room_ids)

    db.commit()
    return get_booking(db, booking.id)


def checkout_booking(db: Session, booking_id: int, payload: CheckoutRequest) -> Booking:
    """Record the guest's departure date/time, mark the booking checked out and free the rooms."""
    booking = get_booking(db, booking_id)
    if booking.status not in (BookingStatus.confirmed, BookingStatus.checked_in):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only active bookings can be checked out",
        )
    if payload.check_out < booking.check_in:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Check-out date cannot be before check-in date",
        )
    _validate_times(booking.check_in, booking.check_in_time, payload.check_out, payload.check_out_time)
    _validate_discount(booking.effective_rate, booking.discount, booking.check_in, payload.check_out)

    previous_status = booking.status
    room_ids = [r.room_id for r in booking.rooms]
    booking.check_out = payload.check_out
    booking.check_out_time = payload.check_out_time
    booking.status = BookingStatus.checked_out
    _sync_room_status(db, booking, previous_status, BookingStatus.checked_out, room_ids)

    db.commit()
    return get_booking(db, booking.id)


def mark_invoice_printed(db: Session, booking: Booking) -> None:
    """Lock the bill against deletion the first time its invoice is printed."""
    if booking.invoice_printed_at is None:
        booking.invoice_printed_at = datetime.now(timezone.utc)
        db.commit()


def cancel_booking(db: Session, booking_id: int) -> Booking:
    """Soft-cancel a booking (kept for history) and free its rooms if they were occupied."""
    booking = get_booking(db, booking_id)
    previous_status = booking.status
    room_ids = [r.room_id for r in booking.rooms]
    booking.status = BookingStatus.cancelled
    _sync_room_status(db, booking, previous_status, BookingStatus.cancelled, room_ids)
    db.commit()
    return get_booking(db, booking.id)


def delete_booking(db: Session, booking_id: int) -> None:
    booking = get_booking(db, booking_id)
    if booking.invoice_printed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This bill has been printed, so it can't be deleted",
        )
    # Free the rooms if this booking currently occupies them.
    if booking.status == BookingStatus.checked_in:
        for line in booking.rooms:
            if line.room.status == RoomStatus.occupied:
                line.room.status = RoomStatus.available
    db.delete(booking)
    db.commit()


def _sync_room_status(
    db: Session,
    booking: Booking,
    previous: BookingStatus,
    new: BookingStatus,
    old_room_ids: list[int],
) -> None:
    """Keep room status in sync with booking transitions (check-in -> occupied, etc.)."""
    new_room_ids = [r.room_id for r in booking.rooms]

    to_free: set[int] = set()
    if previous == BookingStatus.checked_in:
        # Rooms dropped from the booking, or every room if the guest left / booking was voided.
        to_free |= set(old_room_ids) - set(new_room_ids)
        if new != BookingStatus.checked_in:
            to_free |= set(old_room_ids)
    for room_id in to_free:
        room = db.get(Room, room_id)
        # Never overrule a maintenance flag.
        if room is not None and room.status == RoomStatus.occupied:
            room.status = RoomStatus.available

    if new == BookingStatus.checked_in:
        for room_id in new_room_ids:
            room = db.get(Room, room_id)
            if room is not None:
                room.status = RoomStatus.occupied
