"""
Room management service.
"""
import uuid
import random
import string
from sqlalchemy.orm import Session
from app.models.models import Room, Participant, RoomStatus, ParticipantRole


def generate_room_code(length: int = 5) -> str:
    """Generate a short uppercase alphanumeric room code like K7F4Q."""
    chars = string.ascii_uppercase + string.digits
    # Remove ambiguous characters
    chars = chars.replace("0", "").replace("O", "").replace("I", "").replace("1", "")
    return "".join(random.choices(chars, k=length))


def create_unique_room_code(db: Session) -> str:
    for _ in range(20):
        code = generate_room_code()
        existing = db.query(Room).filter(Room.code == code).first()
        if not existing:
            return code
    raise RuntimeError("Failed to generate unique room code")


def create_room(db: Session, display_name: str, guest_uuid: uuid.UUID, user_id: uuid.UUID | None = None) -> tuple[Room, Participant]:
    code = create_unique_room_code(db)
    room = Room(code=code, status=RoomStatus.waiting)
    db.add(room)
    db.flush()  # Get room.id

    participant = Participant(
        room_id=room.id,
        user_id=user_id,
        guest_uuid=guest_uuid,
        display_name=display_name,
        role=ParticipantRole.host,
        is_connected=True,
    )
    db.add(participant)
    db.flush()

    room.host_participant_id = participant.id
    db.commit()
    db.refresh(room)
    db.refresh(participant)
    return room, participant


def join_room(
    db: Session, room_code: str, display_name: str, guest_uuid: uuid.UUID, user_id: uuid.UUID | None = None
) -> tuple[Room, Participant]:
    room = db.query(Room).filter(Room.code == room_code.upper()).first()
    if not room:
        raise ValueError("الغرفة غير موجودة")
    if room.status == RoomStatus.closed:
        raise ValueError("الغرفة مغلقة")
    if room.status == RoomStatus.finished:
        raise ValueError("الغرفة انتهت")

    participant = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.guest_uuid == guest_uuid,
    ).first()

    if participant and participant.user_id != user_id:
        raise ValueError("هذه الجلسة مرتبطة بحساب آخر؛ أعد تسجيل الدخول")
    if not participant and user_id:
        participant = db.query(Participant).filter(Participant.room_id == room.id, Participant.user_id == user_id).first()
    if participant:
        if not participant.is_active:
            raise ValueError("تمت إزالتك من هذه الغرفة")
        participant.is_connected = True
        participant.display_name = display_name
        participant.guest_uuid = guest_uuid
        db.commit()
        db.refresh(participant)
        return room, participant

    # Check for duplicate name
    name_taken = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.display_name == display_name,
        Participant.is_active == True,
    ).first()
    if name_taken:
        raise ValueError(f"الاسم '{display_name}' مستخدم بالفعل في هذه الغرفة")

    participant = Participant(
        room_id=room.id,
        user_id=user_id,
        guest_uuid=guest_uuid,
        display_name=display_name,
        role=ParticipantRole.audience,
        is_connected=True,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return room, participant


def get_room_by_code(db: Session, room_code: str) -> Room | None:
    return db.query(Room).filter(Room.code == room_code.upper()).first()


def set_participant_disconnected(db: Session, participant_id: uuid.UUID):
    p = db.query(Participant).filter(Participant.id == participant_id).first()
    if p:
        p.is_connected = False
        db.commit()


def set_participant_connected(db: Session, participant_id: uuid.UUID):
    p = db.query(Participant).filter(Participant.id == participant_id).first()
    if p:
        p.is_connected = True
        db.commit()


async def close_room(db: Session, room_code: str, guest_uuid: str):
    room = db.query(Room).filter(Room.code == room_code.upper()).first()
    if not room or room.status == RoomStatus.closed:
        raise ValueError("الغرفة غير موجودة أو مغلقة بالفعل")
    
    requester = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.guest_uuid == uuid.UUID(guest_uuid),
        Participant.is_active == True
    ).first()

    if not requester or str(requester.id) != str(room.host_participant_id):
        raise ValueError("فقط مدير الغرفة يمكنه إغلاقها")

    room.status = RoomStatus.closed
    # Cancel active round if any
    from app.services.round_service import get_active_round, cancel_round
    active_round = get_active_round(db, room.id)
    if active_round:
        cancel_round(db, active_round.id)

    db.commit()
    from app.websocket.manager import manager
    await manager.broadcast_to_room(room_code.upper(), {"type": "room_closed", "data": {}})


async def transfer_host(db: Session, room_code: str, guest_uuid: str, target_id: str):
    room = db.query(Room).filter(Room.code == room_code.upper()).first()
    if not room or room.status == RoomStatus.closed:
        raise ValueError("الغرفة غير موجودة أو مغلقة")

    requester = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.guest_uuid == uuid.UUID(guest_uuid),
        Participant.is_active == True
    ).first()

    if not requester or str(requester.id) != str(room.host_participant_id):
        raise ValueError("فقط مدير الغرفة يمكنه نقل الإدارة")

    target = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.id == uuid.UUID(target_id),
        Participant.is_active == True
    ).first()

    if not target:
        raise ValueError("المشارك غير موجود")

    if str(target.id) == str(requester.id):
        raise ValueError("أنت المدير بالفعل")

    room.host_participant_id = target.id
    requester.role = ParticipantRole.audience # Old host becomes audience
    target.role = ParticipantRole.host
    db.commit()

    from app.websocket.manager import manager
    await manager.broadcast_to_room(room_code.upper(), {
        "type": "host_transferred",
        "data": {"new_host_id": str(target.id), "new_host_name": target.display_name}
    })
    # Also trigger state sync to update roles
    from app.api.rooms import _room_to_out
    room_data = _room_to_out(room)
    await manager.broadcast_to_room(room_code.upper(), {
        "type": "state_sync",
        "data": {
            "room_code": room.code,
            "room_status": room.status.value if hasattr(room.status, 'value') else room.status,
            "host_participant_id": str(room.host_participant_id),
            "participants": room_data["participants"]
        }
    })


async def remove_participant(db: Session, room_code: str, guest_uuid: str, target_id: str):
    room = db.query(Room).filter(Room.code == room_code.upper()).first()
    if not room or room.status == RoomStatus.closed:
        raise ValueError("الغرفة غير موجودة أو مغلقة")

    requester = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.guest_uuid == uuid.UUID(guest_uuid),
        Participant.is_active == True
    ).first()

    if not requester or str(requester.id) != str(room.host_participant_id):
        raise ValueError("فقط مدير الغرفة يمكنه إزالة المشاركين")

    if str(requester.id) == target_id:
        raise ValueError("لا يمكنك إزالة نفسك")

    target = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.id == uuid.UUID(target_id),
        Participant.is_active == True
    ).first()

    if not target:
        raise ValueError("المشارك غير موجود")

    target.is_active = False
    target.is_connected = False
    
    # Cancel active round safely if target was an active player
    from app.services.round_service import get_active_round, cancel_round
    active_round = get_active_round(db, room.id)
    if active_round and str(target.id) in [str(active_round.player1_id), str(active_round.player2_id)]:
        cancel_round(db, active_round.id)
        from app.websocket.manager import manager
        await manager.broadcast_to_room(room_code.upper(), {"type": "round_cancelled", "data": {}})

    db.commit()
    
    from app.websocket.manager import manager
    await manager.send_to_participant(room_code.upper(), target_id, {"type": "participant_removed", "data": {}})
    manager.disconnect(room_code.upper(), target_id)

    from app.api.rooms import _room_to_out
    room_data = _room_to_out(room)
    await manager.broadcast_to_room(room_code.upper(), {
        "type": "participant_left",
        "data": {"participant_id": target_id, "display_name": target.display_name, "all_participants": room_data["participants"]}
    })


async def handle_leave_room(db: Session, room_code: str, guest_uuid: str):
    room = db.query(Room).filter(Room.code == room_code.upper()).first()
    if not room or room.status == RoomStatus.closed:
        return

    participant = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.guest_uuid == uuid.UUID(guest_uuid),
        Participant.is_active == True
    ).first()

    if not participant:
        return

    is_host = str(participant.id) == str(room.host_participant_id)
    participant.is_active = False
    participant.is_connected = False

    # Check if any active participants remain
    remaining = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.id != participant.id,
        Participant.is_active == True
    ).order_by(Participant.created_at).all()

    if is_host:
        if remaining:
            # Transfer host to oldest
            new_host = remaining[0]
            new_host.role = ParticipantRole.host
            room.host_participant_id = new_host.id
            db.commit()
            from app.websocket.manager import manager
            await manager.broadcast_to_room(room_code.upper(), {
                "type": "host_transferred",
                "data": {"new_host_id": str(new_host.id), "new_host_name": new_host.display_name}
            })
        else:
            room.status = RoomStatus.closed

    # Cancel active round if participant was playing
    from app.services.round_service import get_active_round, cancel_round
    active_round = get_active_round(db, room.id)
    if active_round and str(participant.id) in [str(active_round.player1_id), str(active_round.player2_id)]:
        cancel_round(db, active_round.id)
        from app.websocket.manager import manager
        await manager.broadcast_to_room(room_code.upper(), {"type": "round_cancelled", "data": {}})
    
    db.commit()

    from app.websocket.manager import manager
    manager.disconnect(room_code.upper(), str(participant.id))
    
    if room.status != RoomStatus.closed:
        from app.api.rooms import _room_to_out
        room_data = _room_to_out(room)
        await manager.broadcast_to_room(room_code.upper(), {
            "type": "participant_left",
            "data": {"participant_id": str(participant.id), "display_name": participant.display_name, "all_participants": room_data["participants"]}
        })
    else:
        await manager.broadcast_to_room(room_code.upper(), {"type": "room_closed", "data": {}})
