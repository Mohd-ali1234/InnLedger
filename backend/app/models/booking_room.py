from sqlalchemy import Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class BookingRoom(Base):
    """One room on a booking, with its own per-night rate (before tax)."""

    __tablename__ = "booking_rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True, nullable=False
    )
    rate: Mapped[float | None] = mapped_column(Float, nullable=True)

    booking: Mapped["Booking"] = relationship("Booking", back_populates="rooms")  # noqa: F821
    room: Mapped["Room"] = relationship("Room", back_populates="booking_lines", lazy="joined")  # noqa: F821

    @property
    def room_number(self) -> str:
        return self.room.room_number

    @property
    def room_name(self) -> str:
        return self.room.room_name

    @property
    def room_type(self) -> str:
        return self.room.room_type

    @property
    def capacity(self) -> int:
        return self.room.capacity

    @property
    def nightly_rate(self) -> float:
        """Per-night rate before tax; falls back to the room's listed price."""
        return self.rate if self.rate is not None else self.room.price
