from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database.session import get_db
from app.schemas.room import RoomCreate, RoomOut, RoomUpdate
from app.services import room_service

router = APIRouter(
    prefix="/rooms", tags=["rooms"], dependencies=[Depends(get_current_admin)]
)


@router.get("", response_model=list[RoomOut])
def list_rooms(db: Session = Depends(get_db)):
    return room_service.list_rooms(db)


@router.get("/{room_id}", response_model=RoomOut)
def get_room(room_id: int, db: Session = Depends(get_db)):
    return room_service.get_room(db, room_id)


@router.post("", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    return room_service.create_room(db, payload)


@router.put("/{room_id}", response_model=RoomOut)
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db)):
    return room_service.update_room(db, room_id, payload)


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room_service.delete_room(db, room_id)
