"""
Guesses API: submit a guess, backend validates against secret animal.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.schemas import SubmitGuessRequest
from app.services import round_service, room_service
from app.models.models import Participant
from app.websocket.manager import manager
from app.websocket.serializers import serialize_round_finished

router = APIRouter(prefix="/api/guesses", tags=["guesses"])


@router.post("/{room_code}/submit")
async def submit_guess(
    room_code: str,
    body: SubmitGuessRequest,
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

    round_ = round_service.get_active_round(db, room.id)
    if not round_:
        raise HTTPException(status_code=404, detail="لا توجد جولة نشطة")

    try:
        guess, is_correct = round_service.submit_guess(db, round_, participant, body.animal_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    from app.game.animals import get_animal_dict
    guessed_animal = get_animal_dict(body.animal_id)

    if is_correct:
        # Round finished — refresh and broadcast victory
        db.refresh(round_)
        round_.player1
        round_.player2
        round_.winner

        finished_data = serialize_round_finished(round_)
        finished_data["end_reason"] = "guess"

        # Build scoreboard
        from app.services.round_service import get_scoreboard
        finished_data["scoreboard"] = get_scoreboard(db, room.id)

        await manager.broadcast_to_room(room_code.upper(), {
            "type": "round_finished",
            "data": finished_data,
        })
        return {"is_correct": True, "round_finished": True, "guess": {
            "animal": guessed_animal,
            "guesser_name": participant.display_name,
        }}
    else:
        # Wrong guess — switch turn
        db.refresh(round_)
        await manager.broadcast_to_room(room_code.upper(), {
            "type": "wrong_guess",
            "data": {
                "guesser_id": str(participant.id),
                "guesser_name": participant.display_name,
                "guessed_animal": guessed_animal,
                "current_turn_player_id": str(round_.current_turn_player_id),
            }
        })
        return {"is_correct": False, "round_finished": False, "current_turn_player_id": str(round_.current_turn_player_id)}
