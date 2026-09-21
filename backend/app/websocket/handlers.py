"""One authenticated WebSocket per participant; audio is relayed, never stored."""
import asyncio
import uuid
import json
import time
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.websocket.manager import manager
from app.websocket.audio import MAX_MESSAGE_BYTES, validate_audio
from app.websocket.serializers import serialize_question, serialize_round_for_participant, serialize_round_finished
from app.services import room_service, round_service
from app.models.models import Participant, Round, RoundStatus, RoomStatus, Question

router = APIRouter()
logger = logging.getLogger(__name__)
_reaction_last_ts: dict[str, float] = {}
REACTION_COOLDOWN = 1.5
ALLOWED_REACTIONS = {"😂", "🔥", "👏", "😱", "🤔", "❤️"}


def _member(db, room_code, participant_id, guest_id):
    room = room_service.get_room_by_code(db, room_code)
    if not room or room.status == RoomStatus.closed:
        raise PermissionError("الغرفة غير متاحة")
    participant = db.query(Participant).filter(
        Participant.id == participant_id, Participant.room_id == room.id,
        Participant.guest_uuid == guest_id, Participant.is_active == True,
    ).first()
    if not participant:
        raise PermissionError("جلسة اللاعب غير صالحة")
    return room, participant


async def _sync(websocket, room_code, p_uuid, guest_id):
    with SessionLocal() as db:
        room, participant = _member(db, room_code, p_uuid, guest_id)
        participant.is_connected = True
        settings = round_service.get_or_create_settings(db, room.id)
        db.commit()
        active = round_service.get_active_round(db, room.id)
        if active and active.timer_duration and active.timer_started_at:
            remaining = active.timer_started_at.timestamp() + active.timer_duration - datetime.now(timezone.utc).timestamp()
            if remaining <= 0:
                round_service.expire_round(db, active)
                finished = serialize_round_finished(active)
                finished["scoreboard"] = round_service.get_scoreboard(db, room.id)
                await manager.broadcast_to_room(room_code, {"type": "round_finished", "data": finished})
                active = None
            else:
                # Restore a timer after a free-host restart from its persisted deadline.
                from app.game.timer import register_timer
                register_timer(active.id, remaining, room_code)
        state = {
            "room_code": room_code, "room_status": room.status.value,
            "host_participant_id": str(room.host_participant_id),
            "participants": [{"id": str(p.id), "display_name": p.display_name,
                "role": p.role.value, "is_connected": p.is_connected, "score": p.score}
                for p in room.participants if p.is_active],
            "settings": {key: getattr(settings, key) for key in
                ("difficulty", "timer_duration", "max_questions", "allow_repeated", "reactions_enabled")},
            "scoreboard": round_service.get_scoreboard(db, room.id),
            "round": None, "round_finished": None, "questions": [],
        }
        history_round = active
        if active:
            state["round"] = serialize_round_for_participant(active, participant)
        else:
            last = db.query(Round).filter(Round.room_id == room.id).order_by(Round.started_at.desc()).first()
            if last and last.status == RoundStatus.finished:
                state["round_finished"] = serialize_round_finished(last)
                state["round_finished"]["scoreboard"] = state["scoreboard"]
                history_round = last
        if history_round:
            state["questions"] = [serialize_question(q) for q in round_service.get_round_questions(db, history_round.id)]
        await websocket.send_json({"type": "state_sync", "data": state})
        await manager.broadcast_to_room(room_code, {"type": "participant_connected", "data": {
            "participant_id": str(p_uuid), "display_name": participant.display_name,
        }}, exclude=str(p_uuid))


async def _voice(websocket, room_code, p_uuid, guest_id, data):
    # Only echo a bounded, syntactically valid request ID; never echo bad payloads.
    request_id = None
    if isinstance(data, dict):
        try:
            request_id = str(uuid.UUID(data.get("request_id", "")))
        except (ValueError, TypeError, AttributeError):
            pass
    try:
        with SessionLocal() as db:
            room, participant = _member(db, room_code, p_uuid, guest_id)
            active = round_service.get_active_round(db, room.id)
            if not active:
                raise PermissionError("لا توجد جولة نشطة")
            audio = validate_audio(data)
            if active.id != audio["round_id"]:
                raise PermissionError("انتهت الجولة الخاصة بهذا التسجيل")
            round_service._lock_action(db, active, participant)
            previous = db.query(Question).filter(Question.client_request_id == uuid.UUID(audio["request_id"])).first()
            if previous:
                if previous.round_id != active.id or previous.asker_id != participant.id:
                    raise PermissionError("معرّف السؤال مستخدم بالفعل")
                metadata = serialize_question(previous)
                # A retry cannot create/rebroadcast another question or replace its audio.
                duplicate = True
            else:
                question = round_service.submit_question(db, active, participant, None,
                    question_type="audio", audio_duration_ms=audio["duration_ms"],
                    client_request_id=uuid.UUID(audio["request_id"]))
                metadata = serialize_question(question)
                duplicate = False
            turn = str(active.current_turn_player_id)
        if not duplicate:
            await manager.broadcast_to_room(room_code, {"type": "question_submitted", "data": {
                "round_id": str(audio["round_id"]), "question": metadata,
                "current_turn_player_id": turn,
                "audio": {"audio_base64": audio["audio_base64"], "mime_type": audio["mime_type"]},
            }})
        await websocket.send_json({"type": "voice_question_accepted", "data": {
            "request_id": audio["request_id"], "question_id": metadata["id"],
        }})
    except (ValueError, PermissionError) as exc:
        await websocket.send_json({"type": "voice_question_error", "data": {
            "request_id": request_id, "message": str(exc),
        }})
    except WebSocketDisconnect:
        raise
    except Exception:
        # Do not include SQL parameters or received media in logs/errors.
        logger.warning("Voice question could not be processed")
        await websocket.send_json({"type": "voice_question_error", "data": {
            "request_id": request_id, "message": "تعذّر تأكيد الإرسال؛ أعد الاتصال للتحقق من سجل الأسئلة",
        }})


@router.websocket("/ws/{room_code}/{participant_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, participant_id: str):
    room_code = room_code.upper()
    registered = False
    await websocket.accept()
    try:
        p_uuid = uuid.UUID(participant_id)
        participant_id = str(p_uuid)
        # Session credentials travel in the first frame, never in a URL/log.
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        if len(raw.encode("utf-8")) > 512:
            raise ValueError()
        auth = json.loads(raw)
        if not isinstance(auth, dict) or auth.get("type") != "authenticate":
            raise ValueError()
        guest_id = uuid.UUID(auth.get("guest_uuid", ""))
        with SessionLocal() as db:
            _member(db, room_code, p_uuid, guest_id)
        await manager.connect(websocket, room_code, participant_id)
        registered = True
        await _sync(websocket, room_code, p_uuid, guest_id)
        last_voice = -1.0
        while True:
            frame = await websocket.receive()
            if frame["type"] == "websocket.disconnect":
                break
            raw = frame.get("text")
            if raw is None or len(raw.encode("utf-8")) > MAX_MESSAGE_BYTES:
                await websocket.close(code=1009)
                break
            if not manager.is_current(room_code, participant_id, websocket):
                break
            try:
                msg = json.loads(raw)
            except (ValueError, RecursionError):
                continue
            if not isinstance(msg, dict):
                continue
            # Membership may change while the socket remains open.
            with SessionLocal() as db:
                _member(db, room_code, p_uuid, guest_id)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg.get("type") == "voice_question":
                now = time.monotonic()
                if now - last_voice < 1:
                    await websocket.close(code=1008)
                    break
                last_voice = now
                await _voice(websocket, room_code, p_uuid, guest_id, msg.get("data"))
            elif msg.get("type") == "reaction" and isinstance(msg.get("data"), dict):
                await _handle_reaction(msg, room_code, participant_id, p_uuid)
    except WebSocketDisconnect:
        pass
    except (ValueError, TypeError, AttributeError, PermissionError, asyncio.TimeoutError):
        await websocket.close(code=4003)
    except Exception:
        logger.warning("WebSocket session ended unexpectedly")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        if registered and manager.disconnect(room_code, participant_id, websocket):
            with SessionLocal() as db:
                room_service.set_participant_disconnected(db, p_uuid)
            _reaction_last_ts.pop(participant_id, None)
            await manager.broadcast_to_room(room_code, {"type": "participant_disconnected", "data": {
                "participant_id": participant_id,
            }})


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

        participant = db.query(Participant).filter(Participant.id == p_uuid, Participant.room_id == room.id, Participant.is_active == True).first()
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
