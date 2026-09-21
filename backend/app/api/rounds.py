"""
Rounds API: start round, new round, get current round info.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.schemas import StartRoundRequest
from app.services import round_service, room_service
from app.models.models import Participant, Round, RoundStatus
from app.websocket.manager import manager
from app.websocket.serializers import serialize_question
from app.game.animals import get_all_animals_for_selector

router = APIRouter(prefix="/api/rounds", tags=["rounds"])
animals_router = APIRouter(prefix="/api/animals", tags=["animals"])


def _require_participant(db: Session, room_code: str, guest_uuid_str: str):
    try:
        guest_id = uuid.UUID(guest_uuid_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="guest_uuid غير صالح")
    room = room_service.get_room_by_code(db, room_code)
    if not room:
        raise HTTPException(status_code=404, detail="الغرفة غير موجودة")
    participant = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.guest_uuid == guest_id,
        Participant.is_active == True,
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="لست عضواً في هذه الغرفة")
    return room, participant


@router.post("/{room_code}/start")
async def start_round(
    room_code: str,
    body: StartRoundRequest,
    guest_uuid: str,
    db: Session = Depends(get_db),
):
    room, host_participant = _require_participant(db, room_code, guest_uuid)

    # Only host can start
    if str(host_participant.id) != str(room.host_participant_id):
        raise HTTPException(status_code=403, detail="فقط مدير الغرفة يستطيع بدء الجولة")

    # Validate players exist in room
    p1 = db.query(Participant).filter(
        Participant.id == body.player1_id,
        Participant.is_active == True,
        Participant.room_id == room.id,
    ).first()
    p2 = db.query(Participant).filter(
        Participant.id == body.player2_id,
        Participant.is_active == True,
        Participant.room_id == room.id,
    ).first()

    if not p1 or not p2:
        raise HTTPException(status_code=400, detail="اللاعبون غير موجودون في الغرفة")
    if str(p1.id) == str(p2.id):
        raise HTTPException(status_code=400, detail="يجب اختيار لاعبين مختلفين")

    # Read host's persisted settings for this room
    settings = round_service.get_or_create_settings(db, room.id)

    round_ = round_service.start_round(
        db, room, body.player1_id, body.player2_id,
        difficulty=settings.difficulty,
        timer_duration=settings.timer_duration,
        max_questions=settings.max_questions,
        allow_repeated=settings.allow_repeated,
        reactions_enabled=settings.reactions_enabled,
    )

    # Refresh relationships for serialization
    db.refresh(round_)
    round_.player1
    round_.player2

    all_participants = db.query(Participant).filter(
        Participant.room_id == room.id, Participant.is_active == True
    ).all()

    # Broadcast with role-aware serialization
    await manager.broadcast_round_started(room_code.upper(), round_, all_participants)

    # Start server-side timer if configured
    if round_.timer_duration:
        from app.game.timer import register_timer
        register_timer(round_.id, round_.timer_duration, room_code.upper())

        # Also broadcast timer_started event so clients get the authoritative end time
        await manager.broadcast_to_room(room_code.upper(), {
            "type": "timer_started",
            "data": {
                "duration_seconds": round_.timer_duration,
                "ends_at": round_.timer_started_at.timestamp() * 1000 + round_.timer_duration * 1000
                if round_.timer_started_at else None,
            }
        })

    return {"message": "بدأت الجولة", "round_id": str(round_.id)}


@router.post("/{room_code}/new-round")
async def new_round(
    room_code: str,
    body: StartRoundRequest,
    guest_uuid: str,
    db: Session = Depends(get_db),
):
    """Host starts a brand new round in the same room."""
    return await start_round(room_code, body, guest_uuid, db)


@router.post("/{room_code}/cancel")
async def cancel_round_api(
    room_code: str,
    guest_uuid: str,
    db: Session = Depends(get_db),
):
    room, host = _require_participant(db, room_code, guest_uuid)
    if str(host.id) != str(room.host_participant_id):
        raise HTTPException(status_code=403, detail="فقط مدير الغرفة يستطيع إلغاء الجولة")
    
    round_ = round_service.get_active_round(db, room.id)
    if not round_:
        raise HTTPException(status_code=400, detail="لا توجد جولة نشطة")
        
    round_service.cancel_round(db, round_.id)
    await manager.broadcast_to_room(room_code.upper(), {"type": "round_cancelled", "data": {}})
    return {"message": "تم إلغاء الجولة"}


@router.post("/{room_code}/rematch")
async def rematch_api(
    room_code: str,
    guest_uuid: str,
    db: Session = Depends(get_db),
):
    room, host = _require_participant(db, room_code, guest_uuid)
    if str(host.id) != str(room.host_participant_id):
        raise HTTPException(status_code=403, detail="فقط مدير الغرفة يستطيع بدء إعادة اللعب")
    
    # Needs the LAST finished round for this room
    last_round = db.query(Round).filter(Round.room_id == room.id).order_by(Round.started_at.desc()).first()
    if not last_round:
        raise HTTPException(status_code=400, detail="لا توجد جولة سابقة")
        
    if last_round.status == RoundStatus.active:
        raise HTTPException(status_code=400, detail="الجولة ما زالت نشطة")
    return await start_round(room_code, StartRoundRequest(
        player1_id=last_round.player1_id, player2_id=last_round.player2_id,
    ), guest_uuid, db)



@router.get("/{room_code}/current")
async def get_current_round(
    room_code: str,
    guest_uuid: str,
    db: Session = Depends(get_db),
):
    room, participant = _require_participant(db, room_code, guest_uuid)
    round_ = round_service.get_active_round(db, room.id)
    if not round_:
        return {"round": None}

    db.refresh(round_)
    round_.player1
    round_.player2

    from app.websocket.serializers import serialize_round_for_participant
    return {"round": serialize_round_for_participant(round_, participant)}


@router.get("/{room_code}/questions")
async def get_questions(
    room_code: str,
    guest_uuid: str,
    db: Session = Depends(get_db),
):
    room, participant = _require_participant(db, room_code, guest_uuid)
    round_ = round_service.get_active_round(db, room.id)
    if not round_:
        return {"questions": []}

    questions = round_service.get_round_questions(db, round_.id)
    return {
        "questions": [
            serialize_question(q)
            for q in questions
        ]
    }


@animals_router.get("/list")
async def list_animals():
    """Return all animals for the client-side selector. No secrets here."""
    return {"animals": get_all_animals_for_selector()}
