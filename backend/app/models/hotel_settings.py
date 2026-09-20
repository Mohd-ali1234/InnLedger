from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class HotelSettings(Base):
    """Single-row table (id=1) holding the hotel identity and tax rates used on bills."""

    __tablename__ = "hotel_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hotel_name: Mapped[str] = mapped_column(String(120), default="HOTEL VR INN", nullable=False)
    tagline: Mapped[str] = mapped_column(String(120), default="ROOMS || RESTAURANT", nullable=False)
    address: Mapped[str] = mapped_column(
        String(255),
        default="At & Po. Vavdi, Ta. Nadod, Rajpipla Kevadiya Colony Road, Dist. Narmada",
        nullable=False,
    )
    mobile_numbers: Mapped[str] = mapped_column(
        String(120), default="+91 96875 08343 || +91 9081657440", nullable=False
    )
    gst_number: Mapped[str] = mapped_column(String(30), default="24DURPP7224M1ZW", nullable=False)
    hsn_code: Mapped[str] = mapped_column(String(20), default="996311", nullable=False)
    cgst_percent: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    sgst_percent: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(80), default="Rajpipla", nullable=False)
