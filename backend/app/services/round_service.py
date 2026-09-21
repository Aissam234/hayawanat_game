"""
Round / Game engine service.
Handles: start round, questions, answers, guesses, victory, timer expiry, settings.
"""
import uuid
import random
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import (
    Room, Participant, Round, Question, Guess, GameEvent, RoomSettings,
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


def get_or_create_settings(db: Session, room_id: uuid.UUID) -> RoomSettings:
    """Return existing room settings or create defaults."""
    settings = db.query(RoomSettings).filter(RoomSettings.room_id == room_id).first()
    if not settings:
        settings = RoomSettings(room_id=room_id)
        db.add(settings)
        db.flush()
    return settings


def update_room_settings(
    db: Session,
    room_id: uuid.UUID,
    difficulty: str | None = None,
    timer_duration: int | None = ...,
    max_questions: int | None = ...,
    allow_repeated: bool | None = None,
    reactions_enabled: bool | None = None,
) -> RoomSettings:
    """Update host game settings. Uses sentinel ... to distinguish 'not provided' from None."""
    settings = get_or_create_settings(db, room_id)
    if difficulty is not None:
        settings.difficulty = difficulty
    if timer_duration is not ...:
        settings.timer_duration = timer_duration
    if max_questions is not ...:
        settings.max_questions = max_questions
    if allow_repeated is not None:
        settings.allow_repeated = allow_repeated
    if reactions_enabled is not None:
        settings.reactions_enabled = reactions_enabled
    db.commit()
    db.refresh(settings)
    return settings


def start_round(
    db: Session,
    room: Room,
    player1_id: uuid.UUID,
    player2_id: uuid.UUID,
    difficulty: str = "medium",
    timer_duration: int | None = None,
    max_questions: int | None = None,
    allow_repeated: bool = True,
    reactions_enabled: bool = True,
) -> Round:
    # End any existing active round
    active = get_active_round(db, room.id)
    if active:
        active.status = RoundStatus.finished
        active.finished_at = datetime.now(timezone.utc)

    # Count previous rounds for numbering
    prev_count = db.query(Round).filter(Round.room_id == room.id).count()

    # Determine exclusions for allow_repeated=False
    exclude_ids: list[int] = []
    if not allow_repeated:
        recent = (
            db.query(Round)
            .filter(Round.room_id == room.id)
            .order_by(Round.started_at.desc())
            .limit(10)
            .all()
        )
        for r in recent:
            exclude_ids.extend([r.player1_animal_id, r.player2_animal_id])
        exclude_ids = list(set(exclude_ids))

    animal1_id, animal2_id = _pick_animals(difficulty, exclude_ids)

    now = datetime.now(timezone.utc)
    round_ = Round(
        room_id=room.id,
        round_number=prev_count + 1,
        player1_id=player1_id,
        player2_id=player2_id,
        player1_animal_id=animal1_id,
        player2_animal_id=animal2_id,
        current_turn_player_id=player1_id,
        status=RoundStatus.active,
        difficulty=difficulty,
        question_count=0,
        guess_count=0,
        timer_duration=timer_duration,
        timer_started_at=now if timer_duration else None,
        max_questions=max_questions,
        allow_repeated=allow_repeated,
        reactions_enabled=reactions_enabled,
    )
    db.add(round_)

    # Update room status and player roles
    room.status = RoomStatus.playing
    _update_player_roles(db, room.id, player1_id, player2_id)

    db.commit()
    db.refresh(round_)
    # Trigger lazy loads for relationships used in serialization
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


def _lock_action(db: Session, round: Round, participant: Participant):
    # One row lock shared by text/audio/answer/guess prevents competing actions.
    db.refresh(round, with_for_update=True)
    db.refresh(participant)
    if not participant.is_active or participant.room_id != round.room_id:
        raise PermissionError("لست عضواً نشطاً في الغرفة")
    if round.status != RoundStatus.active:
        raise PermissionError("الجولة انتهت بالفعل")
    if round.timer_duration and round.timer_started_at:
        if datetime.now(timezone.utc).timestamp() >= round.timer_started_at.timestamp() + round.timer_duration:
            raise PermissionError("انتهى وقت الجولة")


def submit_question(
    db: Session, round: Round, participant: Participant, question_text: str | None,
    *, question_type: str = "text", audio_duration_ms: int | None = None,
    client_request_id: uuid.UUID | None = None,
) -> Question:
    _lock_action(db, round, participant)
    ok, msg = can_submit_question(participant, round)
    if not ok:
        raise PermissionError(msg)
    if db.query(Question).filter(Question.round_id == round.id, Question.answer == QuestionAnswer.pending).first():
        raise PermissionError("انتظر الإجابة على السؤال الحالي")
    if round.max_questions is not None and round.question_count >= round.max_questions:
        raise PermissionError("تم الوصول إلى الحد الأقصى للأسئلة")
    if question_type == "text":
        if not isinstance(question_text, str) or not 1 <= len(question_text.strip()) <= 300:
            raise ValueError("اكتب سؤالاً بين حرف و300 حرف")
        question_text = question_text.strip()
        audio_duration_ms = None
    elif question_type != "audio" or question_text is not None or type(audio_duration_ms) is not int or not 1 <= audio_duration_ms <= 12000:
        raise ValueError("بيانات السؤال غير صالحة")
    question = Question(
        round_id=round.id, asker_id=participant.id, question_text=question_text,
        question_type=question_type, audio_duration_ms=audio_duration_ms,
        client_request_id=client_request_id, answer=QuestionAnswer.pending, is_valid=True,
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
    _lock_action(db, round, participant)
    db.refresh(question)
    if question.round_id != round.id or question.answer != QuestionAnswer.pending:
        raise ValueError("تمت الإجابة أو السؤال لا ينتمي للجولة")
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
    _lock_action(db, round, participant)
    if db.query(Question).filter(Question.round_id == round.id, Question.answer == QuestionAnswer.pending).first():
        raise PermissionError("انتظر الإجابة على السؤال الحالي")
    ok, msg = can_submit_guess(participant, round)
    if not ok:
        raise PermissionError(msg)

    # Double-check round is still active (guard against race with timer)
    db.refresh(round)
    if round.status != RoundStatus.active:
        raise PermissionError("الجولة انتهت بالفعل")

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

        # Award exactly +1 score — within the same transaction as round.status=finished
        participant.score = Participant.score + 1

        # Also award global score if authenticated
        if participant.user_id:
            from app.models.models import User
            user = db.query(User).with_for_update().filter(User.id == participant.user_id).first()
            if user:
                user.total_score = User.total_score + 1

        # Cancel timer if running
        from app.game.timer import cancel_timer
        cancel_timer(round.id)
    else:
        # Wrong guess — switch turn
        _switch_turn(round)

    db.commit()
    db.refresh(guess)
    db.refresh(round)
    db.refresh(participant)
    return guess, is_correct


def expire_round(db: Session, round: Round):
    """Called by the timer task when time runs out. No winner, no points."""
    if round.status != RoundStatus.active:
        return  # Already resolved — idempotent guard
    round.status = RoundStatus.finished
    round.finished_at = datetime.now(timezone.utc)
    round.cancelled_reason = "timer_expired"

    room = db.query(Room).filter(Room.id == round.room_id).first()
    if room:
        room.status = RoomStatus.waiting
    db.commit()


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


def cancel_round(db: Session, round_id: uuid.UUID, reason: str | None = None):
    round_ = db.query(Round).filter(Round.id == round_id).first()
    if round_ and round_.status == RoundStatus.active:
        round_.status = RoundStatus.cancelled
        round_.finished_at = datetime.now(timezone.utc)
        if reason:
            round_.cancelled_reason = reason
        room = db.query(Room).filter(Room.id == round_.room_id).first()
        if room:
            room.status = RoomStatus.waiting
        # Cancel timer too
        from app.game.timer import cancel_timer
        cancel_timer(round_.id)
        db.commit()


def rematch(db: Session, room: Room, old_round: Round) -> Round:
    """Start a new round with the same players as last round."""
    player1_id = old_round.player1_id
    player2_id = old_round.player2_id

    # Use current room settings
    settings = get_or_create_settings(db, room.id)

    exclude: list[int] = []
    if not settings.allow_repeated:
        exclude = [old_round.player1_animal_id, old_round.player2_animal_id]

    active = get_active_round(db, room.id)
    if active:
        active.status = RoundStatus.finished
        active.finished_at = datetime.now(timezone.utc)

    prev_count = db.query(Round).filter(Round.room_id == room.id).count()
    animal1_id, animal2_id = _pick_animals(settings.difficulty, exclude_ids=exclude)

    now = datetime.now(timezone.utc)
    round_ = Round(
        room_id=room.id,
        round_number=prev_count + 1,
        player1_id=player1_id,
        player2_id=player2_id,
        player1_animal_id=animal1_id,
        player2_animal_id=animal2_id,
        current_turn_player_id=player1_id,
        status=RoundStatus.active,
        difficulty=settings.difficulty,
        question_count=0,
        guess_count=0,
        timer_duration=settings.timer_duration,
        timer_started_at=now if settings.timer_duration else None,
        max_questions=settings.max_questions,
        allow_repeated=settings.allow_repeated,
        reactions_enabled=settings.reactions_enabled,
    )
    db.add(round_)
    room.status = RoomStatus.playing
    _update_player_roles(db, room.id, player1_id, player2_id)

    db.commit()
    db.refresh(round_)
    _ = round_.player1
    _ = round_.player2
    return round_


def get_scoreboard(db: Session, room_id: uuid.UUID) -> list[dict]:
    """Return participants sorted by score descending."""
    participants = (
        db.query(Participant)
        .filter(Participant.room_id == room_id, Participant.is_active == True)
        .order_by(Participant.score.desc())
        .all()
    )
    return [
        {"participant_id": str(p.id), "display_name": p.display_name, "score": p.score}
        for p in participants
    ]
