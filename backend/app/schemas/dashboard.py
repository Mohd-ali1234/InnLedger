from pydantic import BaseModel

from app.schemas.booking import BookingOut


class DashboardStats(BaseModel):
    total_rooms: int
    available_rooms: int
    occupied_rooms: int
    maintenance_rooms: int
    total_bookings: int
    todays_check_ins: int
    todays_check_outs: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_bookings: list[BookingOut]
