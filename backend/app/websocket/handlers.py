"""
WebSocket endpoint handler.
Each participant connects to: /ws/{room_code}/{participant_id}
"""
import uuid
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.websocket.manager import manager
from app.services import room_service
from app.models.models import Participant

router = APIRouter()
logger = logging.getLogger(__name__)


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

    # Validate participant_id format
    try:
        p_uuid = uuid.UUID(participant_id)
    except ValueError:
        await websocket.close(code=4000)
        return

    await manager.connect(websocket, room_code, participant_id)

    # Update DB connection status
    db = next(get_db())
    try:
        room_service.set_participant_connected(db, p_uuid)

        # Get participant info
        participant = db.query(Participant).filter(Participant.id == p_uuid).first()
        if not participant:
            await websocket.close(code=4003)
            return

        # Notify others of reconnect/join
        await manager.broadcast_to_room(room_code, {
            "type": "participant_connected",
            "data": {
                "participant_id": participant_id,
                "display_name": participant.display_name,
            }
        }, exclude=participant_id)

        # Send current state to the reconnecting client
        room = room_service.get_room_by_code(db, room_code)
        if room:
            from app.services.round_service import get_active_round, get_round_questions
            from app.websocket.serializers import serialize_round_for_participant

            active_round = get_active_round(db, room.id)
            state_payload: dict = {
                "type": "state_sync",
                "data": {
                    "room_code": room_code,
                    "room_status": room.status.value if hasattr(room.status, 'value') else room.status,
                    "participants": [
                        {
                            "id": str(p.id),
                            "display_name": p.display_name,
                            "role": p.role.value if hasattr(p.role, 'value') else p.role,
                            "is_connected": p.is_connected,
                        }
                        for p in room.participants
                    ],
                    "host_participant_id": str(room.host_participant_id) if room.host_participant_id else None,
                }
            }

            if active_round:
                db.refresh(active_round)
                active_round.player1
                active_round.player2
                state_payload["data"]["round"] = serialize_round_for_participant(active_round, participant)

                questions = get_round_questions(db, active_round.id)
                state_payload["data"]["questions"] = [
                    {
                        "id": str(q.id),
                        "asker_id": str(q.asker_id),
                        "asker_name": q.asker.display_name if q.asker else "",
                        "question_text": q.question_text,
                        "answer": q.answer.value if hasattr(q.answer, 'value') else q.answer,
                        "is_valid": q.is_valid,
                        "created_at": q.created_at.isoformat(),
                    }
                    for q in questions
                ]

            await manager.send_to_participant(room_code, participant_id, state_payload)

    finally:
        db.close()

    # Main receive loop (keepalive + ping/pong)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await manager.send_to_participant(room_code, participant_id, {"type": "pong"})
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(room_code, participant_id)
        db2 = next(get_db())
        try:
            room_service.set_participant_disconnected(db2, p_uuid)
            await manager.broadcast_to_room(room_code, {
                "type": "participant_disconnected",
                "data": {"participant_id": participant_id}
            })
        finally:
            db2.close()
        logger.info(f"[WS] {participant_id} disconnected from {room_code}")
