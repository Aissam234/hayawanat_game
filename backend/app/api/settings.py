"""
Settings API: Host can update game settings for the room.
Only accessible by the current host. Returns 403 for everyone else.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.schemas import GameSettingsRequest, GameSettingsOut
from app.services import room_service, round_service
from app.models.models import Participant, RoomStatus
from app.websocket.manager import manager

router = APIRouter(prefix="/api/rooms", tags=["settings"])


@router.post("/{room_code}/settings")
async def update_game_settings(
    room_code: str,
    body: GameSettingsRequest,
    guest_uuid: str,
    db: Session = Depends(get_db),
):
    try:
        guest_id = uuid.UUID(guest_uuid)
    except ValueError:
        raise HTTPException(status_code=400, detail="guest_uuid غير صالح")

    room = room_service.get_room_by_code(db, room_code)
    if not room:
        raise HTTPException(status_code=404, detail="الغرفة غير موجودة")

    participant = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.guest_uuid == guest_id,
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="لست عضواً في هذه الغرفة")

    # Only the host may change settings
    if str(participant.id) != str(room.host_participant_id):
        raise HTTPException(status_code=403, detail="فقط المدير يمكنه تغيير الإعدادات")

    # Cannot change settings during an active round
    if room.status == RoomStatus.playing:
        raise HTTPException(status_code=400, detail="لا يمكن تغيير الإعدادات أثناء جولة نشطة")

    # Build update kwargs — only include keys that were actually sent
    timer_val = body.timer_duration if body.timer_duration is not None else ...
    max_q_val = body.max_questions if body.max_questions is not None else ...

    settings = round_service.update_room_settings(
        db,
        room.id,
        difficulty=body.difficulty,
        timer_duration=timer_val,
        max_questions=max_q_val,
        allow_repeated=body.allow_repeated,
        reactions_enabled=body.reactions_enabled,
    )

    out = {
        "difficulty": settings.difficulty,
        "timer_duration": settings.timer_duration,
        "max_questions": settings.max_questions,
        "allow_repeated": settings.allow_repeated,
        "reactions_enabled": settings.reactions_enabled,
    }

    # Broadcast to whole room so all clients update their UI
    await manager.broadcast_to_room(room_code.upper(), {
        "type": "game_settings_updated",
        "data": {"settings": out},
    })

    return {"settings": out}


@router.get("/{room_code}/settings")
async def get_game_settings(
    room_code: str,
    db: Session = Depends(get_db),
):
    room = room_service.get_room_by_code(db, room_code)
    if not room:
        raise HTTPException(status_code=404, detail="الغرفة غير موجودة")
    settings = round_service.get_or_create_settings(db, room.id)
    return {
        "settings": {
            "difficulty": settings.difficulty,
            "timer_duration": settings.timer_duration,
            "max_questions": settings.max_questions,
            "allow_repeated": settings.allow_repeated,
            "reactions_enabled": settings.reactions_enabled,
        }
    }
