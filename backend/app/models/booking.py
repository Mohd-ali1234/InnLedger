from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import BookingStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Extra charges that can be added to a stay, in invoice order: (key, invoice label).
SERVICE_FIELDS: list[tuple[str, str]] = [
    ("food_beverages", "Food & Beverages"),
    ("laundry", "Laundry"),
    ("miscellaneous", "Miscellaneous Exp."),
    ("taxi", "Taxi"),
    ("extra_person", "Extra Person"),
    ("extra_bed", "Extra Bed"),
]


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Guest information
    guest_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    guest_gst_number: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Booking information
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    # NULL until the guest actually checks out (the stay is open-ended until then).
    check_out: Mapped[date | None] = mapped_column(Date, nullable=True)
    guest_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
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

    # Service charges (before tax); GST at the booking's CGST/SGST rates is added on top.
    svc_food_beverages: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    svc_laundry: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    svc_miscellaneous: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    svc_taxi: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    svc_extra_person: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    svc_extra_bed: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Set the first time the invoice is printed; from then on the bill can't be deleted.
    # (Just viewing the invoice does not count.)
    invoice_printed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow, nullable=False
    )

    room: Mapped["Room"] = relationship("Room", back_populates="bookings")  # noqa: F821
    rooms: Mapped[list["BookingRoom"]] = relationship(  # noqa: F821
        "BookingRoom",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingRoom.id",
        lazy="selectin",
    )
    documents: Mapped[list["BookingDocument"]] = relationship(  # noqa: F821
        "BookingDocument",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingDocument.id",
        lazy="selectin",
    )

    # ---- Billing (derived) -------------------------------------------------------------
    @property
    def invoice_printed(self) -> bool:
        return self.invoice_printed_at is not None

    @property
    def room_numbers(self) -> str:
        names = [r.room_number for r in self.rooms] or ([self.room.room_number] if self.room else [])
        return ", ".join(names)

    @property
    def effective_rate(self) -> float:
        """Total per-night rate across all rooms, before tax."""
        if self.rooms:
            return round(sum(r.nightly_rate for r in self.rooms), 2)
        return self.rate if self.rate is not None else (self.room.price if self.room else 0.0)

    @property
    def effective_check_out(self) -> date:
        """Real check-out, or today while the guest is still staying (running bill)."""
        return self.check_out or max(date.today(), self.check_in)

    @property
    def nights(self) -> int:
        """Nights charged; a same-day stay still bills one night."""
        return max(1, (self.effective_check_out - self.check_in).days)

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

    # ---- Services (extra charges) ------------------------------------------------------
    @property
    def services(self) -> dict[str, float]:
        return {key: float(getattr(self, f"svc_{key}") or 0.0) for key, _ in SERVICE_FIELDS}

    @property
    def service_lines(self) -> list[tuple[str, float, float, float]]:
        """(label, amount, CGST, SGST) for each service, in invoice order."""
        lines = []
        for key, label in SERVICE_FIELDS:
            amount = round(float(getattr(self, f"svc_{key}") or 0.0), 2)
            lines.append(
                (
                    label,
                    amount,
                    round(amount * self.cgst_percent / 100, 2),
                    round(amount * self.sgst_percent / 100, 2),
                )
            )
        return lines

    @property
    def services_amount(self) -> float:
        return round(sum(amount for _, amount, _, _ in self.service_lines), 2)

    @property
    def services_total(self) -> float:
        """Services including their GST."""
        return round(sum(a + c + s for _, a, c, s in self.service_lines), 2)

    @property
    def grand_total(self) -> float:
        """Rooms (incl. GST) plus services (incl. GST): the amount the guest pays."""
        return round(self.total + self.services_total, 2)
