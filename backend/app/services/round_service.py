"""
Round / Game engine service.
Handles: start round, questions, answers, guesses, victory.
"""
import uuid
import random
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import (
    Room, Participant, Round, Question, Guess, GameEvent,
    RoomStatus, ParticipantRole, RoundStatus, QuestionAnswer
)
from app.game.animals import ANIMALS_BY_DIFFICULTY, ANIMALS, get_animal
from app.game.permissions import (
    can_submit_question, can_answer_question, can_submit_guess,
    get_secret_animal_id_for_player
)


def _pick_animals(difficulty: str, exclude_ids: list[int] = None) -> tuple[int, int]:
    """Pick 2 different animals based on difficulty."""
    exclude_ids = exclude_ids or []

    if difficulty == "random":
        pool = [a for a in ANIMALS if a.id not in exclude_ids]
    else:
        pool = [a for a in ANIMALS_BY_DIFFICULTY.get(difficulty, ANIMALS) if a.id not in exclude_ids]

    if len(pool) < 2:
        pool = [a for a in ANIMALS]  # Fallback to all

    chosen = random.sample(pool, 2)
    return chosen[0].id, chosen[1].id


def get_active_round(db: Session, room_id: uuid.UUID) -> Round | None:
    return db.query(Round).filter(
        Round.room_id == room_id,
        Round.status == RoundStatus.active,
    ).first()


def start_round(
    db: Session,
    room: Room,
    player1_id: uuid.UUID,
    player2_id: uuid.UUID,
    difficulty: str = "medium",
) -> Round:
    # End any existing active round
    active = get_active_round(db, room.id)
    if active:
        active.status = RoundStatus.finished
        active.finished_at = datetime.now(timezone.utc)

    # Count previous rounds
    prev_count = db.query(Round).filter(Round.room_id == room.id).count()

    animal1_id, animal2_id = _pick_animals(difficulty)

    round_ = Round(
        room_id=room.id,
        round_number=prev_count + 1,
        player1_id=player1_id,
        player2_id=player2_id,
        player1_animal_id=animal1_id,
        player2_animal_id=animal2_id,
        current_turn_player_id=player1_id,  # Player 1 goes first
        status=RoundStatus.active,
        difficulty=difficulty,
        question_count=0,
        guess_count=0,
    )
    db.add(round_)

    # Update room status and player roles
    room.status = RoomStatus.playing
    _update_player_roles(db, room.id, player1_id, player2_id)

    db.commit()
    db.refresh(round_)
    # Trigger lazy load for relationships used in serialization
    _ = round_.player1
    _ = round_.player2
    return round_


def _update_player_roles(
    db: Session, room_id: uuid.UUID, player1_id: uuid.UUID, player2_id: uuid.UUID
):
    participants = db.query(Participant).filter(Participant.room_id == room_id).all()
    for p in participants:
        if str(p.id) in [str(player1_id), str(player2_id)]:
            if p.role != ParticipantRole.host:
                p.role = ParticipantRole.player
        elif p.role != ParticipantRole.host:
            p.role = ParticipantRole.audience
    db.flush()


def submit_question(
    db: Session,
    round: Round,
    participant: Participant,
    question_text: str,
) -> Question:
    ok, msg = can_submit_question(participant, round)
    if not ok:
        raise PermissionError(msg)

    question = Question(
        round_id=round.id,
        asker_id=participant.id,
        question_text=question_text,
        answer=QuestionAnswer.pending,
        is_valid=True,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def answer_question(
    db: Session,
    round: Round,
    participant: Participant,
    question: Question,
    answer: str,
) -> Question:
    ok, msg = can_answer_question(participant, round, question.asker_id)
    if not ok:
        raise PermissionError(msg)

    if answer not in ("yes", "no", "invalid"):
        raise ValueError("الإجابة يجب أن تكون: yes أو no أو invalid")

    question.answer = QuestionAnswer(answer)
    question.answered_at = datetime.now(timezone.utc)

    if answer == "invalid":
        question.is_valid = False
        # Don't switch turn — same player asks again
    else:
        question.is_valid = True
        round.question_count += 1
        # Switch turn
        _switch_turn(round)

    db.commit()
    db.refresh(question)
    db.refresh(round)
    return question


def _switch_turn(round: Round):
    if str(round.current_turn_player_id) == str(round.player1_id):
        round.current_turn_player_id = round.player2_id
    else:
        round.current_turn_player_id = round.player1_id


def submit_guess(
    db: Session,
    round: Round,
    participant: Participant,
    animal_id: int,
) -> tuple[Guess, bool]:
    ok, msg = can_submit_guess(participant, round)
    if not ok:
        raise PermissionError(msg)

    secret_animal_id = get_secret_animal_id_for_player(participant, round)
    is_correct = (animal_id == secret_animal_id)

    guess = Guess(
        round_id=round.id,
        guesser_id=participant.id,
        animal_id=animal_id,
        is_correct=is_correct,
    )
    db.add(guess)
    round.guess_count += 1

    if is_correct:
        round.status = RoundStatus.finished
        round.winner_id = participant.id
        round.finished_at = datetime.now(timezone.utc)
        round.room.status = RoomStatus.waiting
    else:
        # Wrong guess — switch turn
        _switch_turn(round)

    db.commit()
    db.refresh(guess)
    db.refresh(round)
    return guess, is_correct


def log_game_event(db: Session, round_id: uuid.UUID, event_type: str, payload: dict):
    event = GameEvent(round_id=round_id, event_type=event_type, payload=payload)
    db.add(event)
    db.commit()


def get_round_questions(db: Session, round_id: uuid.UUID) -> list[Question]:
    return (
        db.query(Question)
        .filter(Question.round_id == round_id)
        .order_by(Question.created_at.asc())
        .all()
    )


def cancel_round(db: Session, round_id: uuid.UUID):
    round_ = db.query(Round).filter(Round.id == round_id).first()
    if round_ and round_.status == RoundStatus.active:
        round_.status = RoundStatus.cancelled
        round_.finished_at = datetime.now(timezone.utc)
        room = db.query(Room).filter(Room.id == round_.room_id).first()
        if room:
            room.status = RoomStatus.waiting
        db.commit()


def rematch(db: Session, room: Room, old_round: Round) -> Round:
    # Same players as old round
    player1_id = old_round.player1_id
    player2_id = old_round.player2_id
    
    # Exclude the animals they just had
    exclude = [old_round.player1_animal_id, old_round.player2_animal_id]
    
    active = get_active_round(db, room.id)
    if active:
        active.status = RoundStatus.finished
        active.finished_at = datetime.now(timezone.utc)

    prev_count = db.query(Round).filter(Round.room_id == room.id).count()
    animal1_id, animal2_id = _pick_animals(old_round.difficulty, exclude_ids=exclude)

    round_ = Round(
        room_id=room.id,
        round_number=prev_count + 1,
        player1_id=player1_id,
        player2_id=player2_id,
        player1_animal_id=animal1_id,
        player2_animal_id=animal2_id,
        current_turn_player_id=player1_id,
        status=RoundStatus.active,
        difficulty=old_round.difficulty,
        question_count=0,
        guess_count=0,
    )
    db.add(round_)
    room.status = RoomStatus.playing
    _update_player_roles(db, room.id, player1_id, player2_id)

    db.commit()
    db.refresh(round_)
    _ = round_.player1
    _ = round_.player2
    return round_
