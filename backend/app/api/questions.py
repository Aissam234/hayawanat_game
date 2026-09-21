"""
Questions API: submit question, answer question.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.schemas import SubmitQuestionRequest, AnswerQuestionRequest
from app.services import round_service, room_service
from app.models.models import Participant, Question, QuestionAnswer
from app.websocket.manager import manager
from app.websocket.serializers import serialize_question

router = APIRouter(prefix="/api/questions", tags=["questions"])


def _get_participant_and_round(db: Session, room_code: str, guest_uuid_str: str):
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
    round_ = round_service.get_active_round(db, room.id)
    if not round_:
        raise HTTPException(status_code=404, detail="لا توجد جولة نشطة")
    return room, participant, round_


@router.post("/{room_code}/submit")
async def submit_question(
    room_code: str,
    body: SubmitQuestionRequest,
    guest_uuid: str,
    db: Session = Depends(get_db),
):
    room, participant, round_ = _get_participant_and_round(db, room_code, guest_uuid)

    try:
        question = round_service.submit_question(db, round_, participant, body.question_text)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    q_data = serialize_question(question)

    # Broadcast question to all in room
    await manager.broadcast_to_room(room_code.upper(), {
        "type": "question_submitted",
        "data": {
            "question": q_data,
            "current_turn_player_id": str(round_.current_turn_player_id),
        }
    })

    return {"question": q_data}


@router.post("/{question_id}/answer")
async def answer_question(
    question_id: str,
    room_code: str,
    body: AnswerQuestionRequest,
    guest_uuid: str,
    db: Session = Depends(get_db),
):
    room, participant, round_ = _get_participant_and_round(db, room_code, guest_uuid)

    try:
        q_id = uuid.UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="question_id غير صالح")

    question = db.query(Question).filter(Question.id == q_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="السؤال غير موجود")
    if str(question.round_id) != str(round_.id):
        raise HTTPException(status_code=400, detail="السؤال لا ينتمي لهذه الجولة")
    if question.answer != QuestionAnswer.pending:
        raise HTTPException(status_code=400, detail="تم الإجابة على هذا السؤال بالفعل")

    try:
        question = round_service.answer_question(db, round_, participant, question, body.answer)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.refresh(round_)

    answer_data = {
        "question_id": str(question.id),
        "answer": question.answer.value,
        "answerer_name": participant.display_name,
        "is_valid": question.is_valid,
    }

    # Broadcast answer + turn change
    await manager.broadcast_to_room(room_code.upper(), {
        "type": "answer_submitted",
        "data": {
            **answer_data,
            "question_count": round_.question_count,
            "current_turn_player_id": str(round_.current_turn_player_id) if round_.current_turn_player_id else None,
        }
    })

    return {"answer": answer_data, "current_turn_player_id": str(round_.current_turn_player_id) if round_.current_turn_player_id else None}
