from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking
from app.models.enums import BookingStatus, RoomStatus
from app.models.room import Room
from app.schemas.dashboard import DashboardResponse, DashboardStats


def _count_rooms_by_status(db: Session, room_status: RoomStatus) -> int:
    return db.query(func.count(Room.id)).filter(Room.status == room_status).scalar() or 0


def get_dashboard(db: Session) -> DashboardResponse:
    today = date.today()

    stats = DashboardStats(
        total_rooms=db.query(func.count(Room.id)).scalar() or 0,
        available_rooms=_count_rooms_by_status(db, RoomStatus.available),
        occupied_rooms=_count_rooms_by_status(db, RoomStatus.occupied),
        maintenance_rooms=_count_rooms_by_status(db, RoomStatus.maintenance),
        total_bookings=db.query(func.count(Booking.id)).scalar() or 0,
        todays_check_ins=(
            db.query(func.count(Booking.id))
            .filter(
                Booking.check_in == today,
                Booking.status != BookingStatus.cancelled,
            )
            .scalar()
            or 0
        ),
        todays_check_outs=(
            db.query(func.count(Booking.id))
            .filter(
                Booking.check_out == today,
                Booking.status != BookingStatus.cancelled,
            )
            .scalar()
            or 0
        ),
    )

    recent = (
        db.query(Booking)
        .options(joinedload(Booking.room))
        .order_by(Booking.created_at.desc())
        .limit(5)
        .all()
    )

    return DashboardResponse(stats=stats, recent_bookings=recent)
