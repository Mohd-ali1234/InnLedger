from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import BookingStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Guest information
    guest_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    email: Mapped[str] = mapped_column(String(120), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    guest_gst_number: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Booking information
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    guest_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus), default=BookingStatus.confirmed, nullable=False
    )

    # Arrival / departure clock times ("HH:MM", 24h)
    check_in_time: Mapped[str] = mapped_column(String(5), default="12:00", nullable=False)
    check_out_time: Mapped[str] = mapped_column(String(5), default="11:00", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(30), default="Cash", nullable=False)

    # Pricing. `rate` is the per-night price BEFORE tax (falls back to the room's price for
    # old rows); the tax percentages are snapshotted so later settings changes don't alter bills.
    rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    discount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cgst_percent: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    sgst_percent: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow, nullable=False
    )

    room: Mapped["Room"] = relationship("Room", back_populates="bookings")  # noqa: F821
    documents: Mapped[list["BookingDocument"]] = relationship(  # noqa: F821
        "BookingDocument",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingDocument.id",
        lazy="selectin",
    )

    # ---- Billing (derived) -------------------------------------------------------------
    @property
    def effective_rate(self) -> float:
        return self.rate if self.rate is not None else (self.room.price if self.room else 0.0)

    @property
    def nights(self) -> int:
        return max(0, (self.check_out - self.check_in).days)

    @property
    def amount(self) -> float:
        """Room charge before discount and tax."""
        return round(self.effective_rate * self.nights, 2)

    @property
    def taxable(self) -> float:
        return round(max(0.0, self.amount - (self.discount or 0.0)), 2)

    @property
    def gst_amount(self) -> float:
        """Total GST, rounded to the whole rupee like the hotel's paper bills (1177 @ 5% -> 59)."""
        rate = self.cgst_percent + self.sgst_percent
        return float(round(self.taxable * rate / 100 + 1e-9))

    @property
    def cgst_amount(self) -> float:
        rate = self.cgst_percent + self.sgst_percent
        return round(self.gst_amount * self.cgst_percent / rate, 2) if rate else 0.0

    @property
    def sgst_amount(self) -> float:
        return round(self.gst_amount - self.cgst_amount, 2)

    @property
    def total(self) -> float:
        return round(self.taxable + self.gst_amount, 2)
