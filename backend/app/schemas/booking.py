from datetime import date, datetime

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.enums import BookingStatus


TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"
PaymentMethod = Literal["Cash", "Online", "UPI", "Card", "Bank Transfer"]


class BookingBase(BaseModel):
    guest_name: str = Field(..., min_length=1, max_length=120)
    phone: str = Field(..., min_length=3, max_length=40)
    email: EmailStr
    address: str | None = Field(None, max_length=255)
    company_name: str | None = Field(None, max_length=120)
    guest_gst_number: str | None = Field(None, max_length=20)
    room_id: int
    check_in: date
    check_out: date
    guest_count: int = Field(..., gt=0)
    check_in_time: str = Field("12:00", pattern=TIME_PATTERN)
    check_out_time: str = Field("11:00", pattern=TIME_PATTERN)
    payment_method: PaymentMethod = "Cash"
    # Per-night price before tax; omitted -> the room's listed price is used.
    rate: float | None = Field(None, ge=0)
    discount: float = Field(0.0, ge=0)

    @model_validator(mode="after")
    def validate_dates(self) -> "BookingBase":
        if self.check_out <= self.check_in:
            raise ValueError("Check-out date must be after check-in date")
        return self


class BookingCreate(BookingBase):
    status: BookingStatus = BookingStatus.confirmed


class BookingUpdate(BaseModel):
    guest_name: str | None = Field(None, min_length=1, max_length=120)
    phone: str | None = Field(None, min_length=3, max_length=40)
    email: EmailStr | None = None
    address: str | None = Field(None, max_length=255)
    company_name: str | None = Field(None, max_length=120)
    guest_gst_number: str | None = Field(None, max_length=20)
    room_id: int | None = None
    check_in: date | None = None
    check_out: date | None = None
    guest_count: int | None = Field(None, gt=0)
    status: BookingStatus | None = None
    check_in_time: str | None = Field(None, pattern=TIME_PATTERN)
    check_out_time: str | None = Field(None, pattern=TIME_PATTERN)
    payment_method: PaymentMethod | None = None
    rate: float | None = Field(None, ge=0)
    discount: float | None = Field(None, ge=0)


class RoomSummary(BaseModel):
    id: int
    room_number: str
    room_name: str
    room_type: str
    capacity: int
    price: float

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: int
    filename: str
    content_type: str
    size: int

    model_config = {"from_attributes": True}


class BookingOut(BaseModel):
    id: int
    room_id: int
    guest_name: str
    phone: str
    email: str
    address: str | None
    company_name: str | None
    guest_gst_number: str | None
    check_in: date
    check_out: date
    guest_count: int
    status: BookingStatus
    check_in_time: str
    check_out_time: str
    payment_method: str
    discount: float
    cgst_percent: float
    sgst_percent: float
    # Derived billing figures (see Booking properties)
    effective_rate: float
    nights: int
    amount: float
    taxable: float
    cgst_amount: float
    sgst_amount: float
    total: float
    documents: list[DocumentOut] = []
    created_at: datetime
    updated_at: datetime
    room: RoomSummary

    model_config = {"from_attributes": True}
