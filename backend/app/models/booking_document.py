from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BookingDocument(Base):
    """An ID / supporting document (image or PDF) uploaded for a booking."""

    __tablename__ = "booking_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)  # original name, for display
    stored_name: Mapped[str] = mapped_column(String(80), nullable=False)  # name on disk
    content_type: Mapped[str] = mapped_column(String(60), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)

    booking: Mapped["Booking"] = relationship("Booking", back_populates="documents")  # noqa: F821
