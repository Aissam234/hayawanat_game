"""
Rooms API: create, join, get, leave.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.schemas import (
    CreateRoomRequest, JoinRoomRequest, RoomOut, ParticipantOut, ErrorResponse
)
from app.services import room_service
from app.websocket.manager import manager

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def _room_to_out(room) -> dict:
    return {
        "id": str(room.id),
        "code": room.code,
        "status": room.status.value if hasattr(room.status, 'value') else room.status,
        "host_participant_id": str(room.host_participant_id) if room.host_participant_id else None,
        "participants": [
            {
                "id": str(p.id),
                "display_name": p.display_name,
                "role": p.role.value if hasattr(p.role, 'value') else p.role,
                "is_connected": p.is_connected,
            }
            for p in room.participants if p.is_active
        ],
    }


@router.post("/")
async def create_room(body: CreateRoomRequest, db: Session = Depends(get_db)):
    try:
        room, participant = room_service.create_room(db, body.display_name, body.guest_uuid)
        return {
            "room": _room_to_out(room),
            "participant": {
                "id": str(participant.id),
                "display_name": participant.display_name,
                "role": participant.role.value,
                "is_connected": participant.is_connected,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{room_code}/join")
async def join_room(room_code: str, body: JoinRoomRequest, db: Session = Depends(get_db)):
    try:
        room, participant = room_service.join_room(
            db, room_code, body.display_name, body.guest_uuid
        )
        room_data = _room_to_out(room)
        participant_data = {
            "id": str(participant.id),
            "display_name": participant.display_name,
            "role": participant.role.value if hasattr(participant.role, 'value') else participant.role,
            "is_connected": participant.is_connected,
        }

        # Broadcast participant_joined to room
        await manager.broadcast_to_room(room_code.upper(), {
            "type": "participant_joined",
            "data": {
                "participant": participant_data,
                "all_participants": room_data["participants"],
            }
        })

        return {"room": room_data, "participant": participant_data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{room_code}")
async def get_room(room_code: str, db: Session = Depends(get_db)):
    room = room_service.get_room_by_code(db, room_code)
    if not room:
        raise HTTPException(status_code=404, detail="الغرفة غير موجودة")
    return _room_to_out(room)


@router.delete("/{room_code}/leave")
async def leave_room(
    room_code: str,
    guest_uuid: str,
    db: Session = Depends(get_db)
):
    try:
        from app.services.room_service import handle_leave_room
        await handle_leave_room(db, room_code, guest_uuid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "تم المغادرة"}


@router.post("/{room_code}/remove-participant")
async def remove_participant(
    room_code: str,
    target_id: str,
    guest_uuid: str,
    db: Session = Depends(get_db)
):
    try:
        from app.services.room_service import remove_participant as svc_remove
        await svc_remove(db, room_code, guest_uuid, target_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "تمت الإزالة"}


@router.post("/{room_code}/transfer-host")
async def transfer_host(
    room_code: str,
    target_id: str,
    guest_uuid: str,
    db: Session = Depends(get_db)
):
    try:
        from app.services.room_service import transfer_host as svc_transfer
        await svc_transfer(db, room_code, guest_uuid, target_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "تم نقل الإدارة"}


@router.post("/{room_code}/close")
async def close_room(
    room_code: str,
    guest_uuid: str,
    db: Session = Depends(get_db)
):
    try:
        from app.services.room_service import close_room as svc_close
        await svc_close(db, room_code, guest_uuid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "تم إغلاق الغرفة"}
