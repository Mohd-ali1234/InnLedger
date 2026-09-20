"""Seed the database with an admin account, 15 rooms, and 10 sample bookings.

Run with:  python -m app.seed
Safe to re-run: it clears existing rooms/bookings and re-creates the admin if missing.
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.database.session import Base, SessionLocal, engine
from app.models.admin import Admin
from app.models.booking import Booking
from app.models.enums import BookingStatus, RoomStatus
from app.models.room import Room

ROOMS = [
    # room_number, room_name, room_type, capacity, floor, price, status
    ("101", "Garden View Single", "Single", 1, 1, 79.0, RoomStatus.available),
    ("102", "Garden View Double", "Double", 2, 1, 119.0, RoomStatus.occupied),
    ("103", "Cozy Twin", "Twin", 2, 1, 109.0, RoomStatus.available),
    ("104", "Standard Queen", "Double", 2, 1, 129.0, RoomStatus.maintenance),
    ("201", "City View Double", "Double", 2, 2, 139.0, RoomStatus.occupied),
    ("202", "Deluxe King", "Deluxe", 2, 2, 189.0, RoomStatus.available),
    ("203", "Deluxe Twin", "Deluxe", 2, 2, 179.0, RoomStatus.available),
    ("204", "Family Room", "Family", 4, 2, 219.0, RoomStatus.occupied),
    ("301", "Executive Suite", "Suite", 3, 3, 289.0, RoomStatus.available),
    ("302", "Junior Suite", "Suite", 2, 3, 249.0, RoomStatus.available),
    ("303", "Panorama Deluxe", "Deluxe", 2, 3, 199.0, RoomStatus.maintenance),
    ("304", "Family Suite", "Family", 5, 3, 329.0, RoomStatus.occupied),
    ("401", "Presidential Suite", "Suite", 4, 4, 499.0, RoomStatus.available),
    ("402", "Penthouse King", "Deluxe", 2, 4, 359.0, RoomStatus.available),
    ("403", "Rooftop Studio", "Studio", 2, 4, 279.0, RoomStatus.occupied),
]


def _seed_admin(db: Session) -> None:
    existing = db.query(Admin).filter(Admin.username == settings.ADMIN_USERNAME).first()
    if existing is None:
        db.add(
            Admin(
                username=settings.ADMIN_USERNAME,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
            )
        )
        db.commit()
        print(f"Created admin '{settings.ADMIN_USERNAME}'.")
    else:
        print(f"Admin '{settings.ADMIN_USERNAME}' already exists.")


def _seed_rooms(db: Session) -> list[Room]:
    db.query(Booking).delete()
    db.query(Room).delete()
    db.commit()

    rooms: list[Room] = []
    for number, name, rtype, capacity, floor, price, status in ROOMS:
        room = Room(
            room_number=number,
            room_name=name,
            room_type=rtype,
            capacity=capacity,
            floor=floor,
            price=price,
            status=status,
        )
        db.add(room)
        rooms.append(room)
    db.commit()
    for room in rooms:
        db.refresh(room)
    print(f"Seeded {len(rooms)} rooms.")
    return rooms


def _seed_bookings(db: Session, rooms: list[Room]) -> None:
    today = date.today()
    by_number = {room.room_number: room for room in rooms}

    # (room_number, guest, phone, email, check_in offset, nights, guest_count, status)
    samples = [
        ("102", "Amelia Turner", "+1 202 555 0141", "amelia.turner@example.com", -1, 3, 2, BookingStatus.checked_in),
        ("201", "James Carter", "+1 202 555 0173", "james.carter@example.com", -2, 4, 2, BookingStatus.checked_in),
        ("204", "Sofia Martinez", "+1 202 555 0118", "sofia.martinez@example.com", 0, 2, 4, BookingStatus.checked_in),
        ("304", "Liam Johnson", "+1 202 555 0199", "liam.johnson@example.com", -3, 5, 5, BookingStatus.checked_in),
        ("403", "Olivia Brown", "+1 202 555 0126", "olivia.brown@example.com", 0, 3, 2, BookingStatus.checked_in),
        ("202", "Noah Davis", "+1 202 555 0182", "noah.davis@example.com", 2, 3, 2, BookingStatus.confirmed),
        ("301", "Emma Wilson", "+1 202 555 0164", "emma.wilson@example.com", 5, 4, 3, BookingStatus.confirmed),
        ("401", "William Moore", "+1 202 555 0150", "william.moore@example.com", 7, 2, 4, BookingStatus.confirmed),
        ("101", "Ava Thompson", "+1 202 555 0137", "ava.thompson@example.com", -6, 3, 1, BookingStatus.checked_out),
        ("203", "Lucas Anderson", "+1 202 555 0109", "lucas.anderson@example.com", 1, 2, 2, BookingStatus.cancelled),
    ]

    count = 0
    for number, guest, phone, email, offset, nights, guests, status in samples:
        room = by_number.get(number)
        if room is None:
            continue
        check_in = today + timedelta(days=offset)
        db.add(
            Booking(
                room_id=room.id,
                guest_name=guest,
                phone=phone,
                email=email,
                check_in=check_in,
                check_out=check_in + timedelta(days=nights),
                guest_count=guests,
                status=status,
            )
        )
        count += 1
    db.commit()
    print(f"Seeded {count} bookings.")


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_admin(db)
        rooms = _seed_rooms(db)
        _seed_bookings(db, rooms)
        print("Seeding complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
