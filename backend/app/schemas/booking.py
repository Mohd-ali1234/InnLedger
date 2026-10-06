from datetime import date, datetime

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.enums import BookingStatus


TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"
PaymentMethod = Literal["Cash", "Online", "UPI", "Card", "Bank Transfer"]


class ServiceCharges(BaseModel):
    """Optional extra charges (before tax); each defaults to zero."""

    food_beverages: float = Field(0.0, ge=0)
    laundry: float = Field(0.0, ge=0)
    miscellaneous: float = Field(0.0, ge=0)
    taxi: float = Field(0.0, ge=0)
    extra_person: float = Field(0.0, ge=0)
    extra_bed: float = Field(0.0, ge=0)


class RoomRateIn(BaseModel):
    room_id: int
    rate: float = Field(..., ge=0)


class BookingBase(BaseModel):
    # Required: name, phone, room, check-in date and rate. Everything else is optional.
    guest_name: str = Field(..., min_length=1, max_length=120)
    phone: str = Field(..., min_length=3, max_length=40)
    email: EmailStr | None = None
    address: str | None = Field(None, max_length=255)
    company_name: str | None = Field(None, max_length=120)
    guest_gst_number: str | None = Field(None, max_length=20)
    # One or more rooms, each with its own per-night rate (before tax).
    rooms: list[RoomRateIn] = Field(..., min_length=1)
    check_in: date
    # Left empty at check-in; filled when the guest checks out.
    check_out: date | None = None
    guest_count: int = Field(1, gt=0)
    check_in_time: str = Field("12:00", pattern=TIME_PATTERN)
    check_out_time: str = Field("11:00", pattern=TIME_PATTERN)
    payment_method: PaymentMethod = "Cash"
    discount: float = Field(0.0, ge=0)
    services: ServiceCharges = ServiceCharges()

    @model_validator(mode="after")
    def validate_dates(self) -> "BookingBase":
        if self.check_out is not None and self.check_out < self.check_in:
            raise ValueError("Check-out date cannot be before check-in date")
        ids = [r.room_id for r in self.rooms]
        if len(ids) != len(set(ids)):
            raise ValueError("The same room was selected twice")
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
    rooms: list[RoomRateIn] | None = Field(None, min_length=1)
    check_in: date | None = None
    check_out: date | None = None
    guest_count: int | None = Field(None, gt=0)
    status: BookingStatus | None = None
    check_in_time: str | None = Field(None, pattern=TIME_PATTERN)
    check_out_time: str | None = Field(None, pattern=TIME_PATTERN)
    payment_method: PaymentMethod | None = None
    services: ServiceCharges | None = None
    discount: float | None = Field(None, ge=0)


class BookingRoomOut(BaseModel):
    room_id: int
    room_number: str
    room_name: str
    room_type: str
    capacity: int
    rate: float = Field(validation_alias="nightly_rate")

    model_config = {"from_attributes": True, "populate_by_name": True}


class RoomSummary(BaseModel):
    id: int
    room_number: str
    room_name: str
    room_type: str
    capacity: int
    price: float

    model_config = {"from_attributes": True}


class CheckoutRequest(BaseModel):
    check_out: date
    check_out_time: str = Field(..., pattern=TIME_PATTERN)


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
    email: str | None
    address: str | None
    company_name: str | None
    guest_gst_number: str | None
    check_in: date
    check_out: date | None
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
    effective_check_out: date
    nights: int
    amount: float
    taxable: float
    cgst_amount: float
    sgst_amount: float
    total: float
    invoice_printed: bool
    services: ServiceCharges
    services_amount: float
    services_total: float
    grand_total: float
    documents: list[DocumentOut] = []
    created_at: datetime
    updated_at: datetime
    room: RoomSummary
    rooms: list[BookingRoomOut] = []
    room_numbers: str

    model_config = {"from_attributes": True}
