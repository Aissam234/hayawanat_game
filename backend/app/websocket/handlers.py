"""
WebSocket endpoint handler.
Each participant connects to: /ws/{room_code}/{participant_id}
Handles: ping/pong, reactions (with rate limiting), future client→server messages.
"""
import uuid
import json
import time
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.db.session import get_db, SessionLocal
from app.websocket.manager import manager
from app.services import room_service, round_service
from app.models.models import Participant

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory reaction rate limiter: participant_id -> last_reaction_timestamp (float)
_reaction_last_ts: dict[str, float] = {}
REACTION_COOLDOWN = 1.5  # seconds

ALLOWED_REACTIONS = {"😂", "🔥", "👏", "😱", "🤔", "❤️"}


@router.websocket("/ws/{room_code}/{participant_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    participant_id: str,
):
    """
    Main WebSocket endpoint. participant_id is their DB UUID.
    """
    room_code = room_code.upper()

    try:
        p_uuid = uuid.UUID(participant_id)
    except ValueError:
        await websocket.close(code=4000)
        return

    await manager.connect(websocket, room_code, participant_id)

    db: Session = SessionLocal()
    try:
        room_service.set_participant_connected(db, p_uuid)

        participant = db.query(Participant).filter(Participant.id == p_uuid).first()
        if not participant:
            await websocket.close(code=4003)
            return

        # Notify others of (re)connect
        await manager.broadcast_to_room(room_code, {
            "type": "participant_connected",
            "data": {
                "participant_id": participant_id,
                "display_name": participant.display_name,
            }
        }, exclude=participant_id)

        # Send full authoritative state to the reconnecting client
        room = room_service.get_room_by_code(db, room_code)
        if room:
            active_round = round_service.get_active_round(db, room.id)
            settings = round_service.get_or_create_settings(db, room.id)
            scoreboard = round_service.get_scoreboard(db, room.id)

            state_data: dict = {
                "room_code": room_code,
                "room_status": room.status.value if hasattr(room.status, "value") else room.status,
                "host_participant_id": str(room.host_participant_id) if room.host_participant_id else None,
                "participants": [
                    {
                        "id": str(p.id),
                        "display_name": p.display_name,
                        "role": p.role.value if hasattr(p.role, "value") else p.role,
                        "is_connected": p.is_connected,
                        "score": p.score,
                    }
                    for p in room.participants
                ],
                "settings": {
                    "difficulty": settings.difficulty,
                    "timer_duration": settings.timer_duration,
                    "max_questions": settings.max_questions,
                    "allow_repeated": settings.allow_repeated,
                    "reactions_enabled": settings.reactions_enabled,
                },
                "scoreboard": scoreboard,
            }

            if active_round:
                db.refresh(active_round)
                _ = active_round.player1
                _ = active_round.player2

                from app.websocket.serializers import serialize_round_for_participant
                state_data["round"] = serialize_round_for_participant(active_round, participant)

                questions = round_service.get_round_questions(db, active_round.id)
                state_data["questions"] = [
                    {
                        "id": str(q.id),
                        "asker_id": str(q.asker_id),
                        "asker_name": q.asker.display_name if q.asker else "",
                        "question_text": q.question_text,
                        "answer": q.answer.value if hasattr(q.answer, "value") else q.answer,
                        "is_valid": q.is_valid,
                        "created_at": q.created_at.isoformat(),
                    }
                    for q in questions
                ]

            await manager.send_to_participant(room_code, participant_id, {
                "type": "state_sync",
                "data": state_data,
            })
    finally:
        db.close()

    # Main receive loop
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")

                if msg_type == "ping":
                    await manager.send_to_participant(room_code, participant_id, {"type": "pong"})

                elif msg_type == "reaction":
                    await _handle_reaction(msg, room_code, participant_id, p_uuid)

            except json.JSONDecodeError:
                pass
            except Exception as e:
                logger.warning(f"[WS] Error processing message from {participant_id}: {e}")

    except WebSocketDisconnect:
        manager.disconnect(room_code, participant_id)
        db2: Session = SessionLocal()
        try:
            room_service.set_participant_disconnected(db2, p_uuid)
            await manager.broadcast_to_room(room_code, {
                "type": "participant_disconnected",
                "data": {"participant_id": participant_id}
            })
        finally:
            db2.close()
        # Clean up rate-limit entry
        _reaction_last_ts.pop(participant_id, None)
        logger.info(f"[WS] {participant_id} disconnected from {room_code}")


async def _handle_reaction(
    msg: dict,
    room_code: str,
    participant_id: str,
    p_uuid: uuid.UUID,
):
    """Process a live audience reaction — rate-limited, transient (not persisted)."""
    emoji = msg.get("data", {}).get("emoji", "")
    if emoji not in ALLOWED_REACTIONS:
        return  # Silently drop invalid reactions

    # Rate limiting — check cooldown
    now = time.monotonic()
    last = _reaction_last_ts.get(participant_id, 0.0)
    if now - last < REACTION_COOLDOWN:
        return  # Drop silently (no error — avoids flooding)
    _reaction_last_ts[participant_id] = now

    # Validate: reactions_enabled on active round + role check
    db: Session = SessionLocal()
    try:
        room = room_service.get_room_by_code(db, room_code)
        if not room:
            return

        participant = db.query(Participant).filter(Participant.id == p_uuid).first()
        if not participant:
            return

        active_round = round_service.get_active_round(db, room.id)
        if not active_round:
            return  # No active round — reactions not allowed

        if not active_round.reactions_enabled:
            return  # Host disabled reactions

        # Active players cannot react (per spec)
        if str(participant.id) in [str(active_round.player1_id), str(active_round.player2_id)]:
            return

        display_name = participant.display_name
    finally:
        db.close()

    # Broadcast reaction to everyone in the room (transient — not stored in DB)
    import time as _time
    await manager.broadcast_to_room(room_code, {
        "type": "reaction",
        "data": {
            "emoji": emoji,
            "participant_id": participant_id,
            "display_name": display_name,
            "ts": _time.time(),
        }
    })
