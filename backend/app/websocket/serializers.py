"""
Role-aware serialization — the core security layer.
A player NEVER receives their own secret animal in any API response or WS event.
"""
import uuid
from app.models.models import Round, Participant
from app.game.animals import get_animal_dict


def serialize_round_for_participant(round: Round, viewer: Participant) -> dict:
    """
    Returns round data tailored to the viewer's role:
    - Player1: sees opponent's animal (player2's animal) only
    - Player2: sees opponent's animal (player1's animal) only
    - Host/Audience: sees both animals
    Also includes timer state so reconnecting clients can restore countdown.
    """
    base = {
        "id": str(round.id),
        "round_number": round.round_number,
        "player1_id": str(round.player1_id),
        "player1_name": round.player1.display_name if round.player1 else "",
        "player2_id": str(round.player2_id),
        "player2_name": round.player2.display_name if round.player2 else "",
        "current_turn_player_id": str(round.current_turn_player_id) if round.current_turn_player_id else None,
        "status": round.status.value if hasattr(round.status, "value") else round.status,
        "difficulty": round.difficulty,
        "question_count": round.question_count,
        "guess_count": round.guess_count,
        # Timer fields — authoritative; frontend uses these to reconstruct countdown
        "timer_duration": round.timer_duration,
        "timer_started_at": round.timer_started_at.isoformat() if round.timer_started_at else None,
        "timer_ends_at": (
            (round.timer_started_at.timestamp() + round.timer_duration) * 1000  # JS ms epoch
            if round.timer_duration and round.timer_started_at else None
        ),
        # Settings visible to all
        "max_questions": round.max_questions,
        "reactions_enabled": round.reactions_enabled,
    }

    viewer_id = str(viewer.id)
    p1_id = str(round.player1_id)
    p2_id = str(round.player2_id)

    if viewer_id == p1_id:
        # Player 1 sees Player 2's animal (their opponent) — NEVER their own
        base["opponent_animal"] = get_animal_dict(round.player2_animal_id)
        base["my_role_in_round"] = "player1"
    elif viewer_id == p2_id:
        # Player 2 sees Player 1's animal (their opponent) — NEVER their own
        base["opponent_animal"] = get_animal_dict(round.player1_animal_id)
        base["my_role_in_round"] = "player2"
    else:
        # Host / Audience see both
        base["player1_animal"] = get_animal_dict(round.player1_animal_id)
        base["player2_animal"] = get_animal_dict(round.player2_animal_id)
        base["my_role_in_round"] = "audience"

    return base


def serialize_round_finished(round: Round) -> dict:
    """Called when round ends — now safe to reveal all animals."""
    return {
        "id": str(round.id),
        "winner_id": str(round.winner_id) if round.winner_id else None,
        "winner_name": round.winner.display_name if round.winner else None,
        "player1_id": str(round.player1_id),
        "player1_name": round.player1.display_name if round.player1 else "",
        "player1_animal": get_animal_dict(round.player1_animal_id),
        "player2_id": str(round.player2_id),
        "player2_name": round.player2.display_name if round.player2 else "",
        "player2_animal": get_animal_dict(round.player2_animal_id),
        "question_count": round.question_count,
        "guess_count": round.guess_count,
        "started_at": round.started_at.isoformat() if round.started_at else None,
        "finished_at": round.finished_at.isoformat() if round.finished_at else None,
        # end_reason: 'guess' | 'timer_expired' | 'cancelled'
        "end_reason": round.cancelled_reason if round.cancelled_reason else "guess",
    }


def serialize_question(question) -> dict:
    """Public metadata only; audio never enters the database or state snapshot."""
    return {
        "id": str(question.id),
        "asker_id": str(question.asker_id),
        "asker_name": question.asker.display_name if question.asker else "",
        "question_text": question.question_text,
        "question_type": question.question_type,
        "audio_duration_ms": question.audio_duration_ms,
        "answer": question.answer.value,
        "is_valid": question.is_valid,
        "created_at": question.created_at.isoformat(),
    }
