import enum


class RoomStatus(str, enum.Enum):
    available = "available"
    occupied = "occupied"
    maintenance = "maintenance"


class BookingStatus(str, enum.Enum):
    confirmed = "confirmed"
    checked_in = "checked_in"
    checked_out = "checked_out"
    cancelled = "cancelled"
