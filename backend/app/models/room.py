from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import RoomStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    room_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    room_name: Mapped[str] = mapped_column(String(120), nullable=False)
    room_type: Mapped[str] = mapped_column(String(50), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    floor: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[RoomStatus] = mapped_column(
        Enum(RoomStatus), default=RoomStatus.available, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow, nullable=False
    )

    bookings: Mapped[list["Booking"]] = relationship(  # noqa: F821
        "Booking", back_populates="room", cascade="all, delete-orphan"
    )
