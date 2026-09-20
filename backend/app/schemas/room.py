from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import RoomStatus


class RoomBase(BaseModel):
    room_number: str = Field(..., min_length=1, max_length=20)
    room_name: str = Field(..., min_length=1, max_length=120)
    room_type: str = Field(..., min_length=1, max_length=50)
    capacity: int = Field(..., gt=0, description="Capacity must be greater than zero")
    floor: int = Field(..., ge=0)
    price: float = Field(..., gt=0, description="Price must be greater than zero")
    status: RoomStatus = RoomStatus.available


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    room_number: str | None = Field(None, min_length=1, max_length=20)
    room_name: str | None = Field(None, min_length=1, max_length=120)
    room_type: str | None = Field(None, min_length=1, max_length=50)
    capacity: int | None = Field(None, gt=0)
    floor: int | None = Field(None, ge=0)
    price: float | None = Field(None, gt=0)
    status: RoomStatus | None = None


class RoomOut(RoomBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
