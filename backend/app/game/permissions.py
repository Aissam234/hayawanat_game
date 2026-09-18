"""
Permission checking for all game actions.
Backend is the authoritative source — never trust the client.
"""
import uuid
from app.models.models import Room, Participant, Round, ParticipantRole, RoundStatus


def get_participant_in_room(
    db, room_id: uuid.UUID, guest_uuid: uuid.UUID
) -> Participant | None:
    return db.query(Participant).filter(
        Participant.room_id == room_id,
        Participant.guest_uuid == guest_uuid,
    ).first()


def can_start_round(participant: Participant, room: Room) -> tuple[bool, str]:
    if str(participant.id) != str(room.host_participant_id):
        return False, "فقط مدير الغرفة يستطيع بدء الجولة"
    if room.status == "playing":
        return False, "الجولة جارية بالفعل"
    return True, ""


def can_submit_question(participant: Participant, round: Round) -> tuple[bool, str]:
    if round.status != RoundStatus.active:
        return False, "الجولة غير نشطة"
    if str(participant.id) not in [str(round.player1_id), str(round.player2_id)]:
        return False, "فقط اللاعبان يستطيعان طرح الأسئلة"
    if str(participant.id) != str(round.current_turn_player_id):
        return False, "ليس دورك الآن"
    return True, ""


def can_answer_question(
    participant: Participant, round: Round, asker_id: uuid.UUID
) -> tuple[bool, str]:
    if round.status != RoundStatus.active:
        return False, "الجولة غير نشطة"
    # The answerer must be the opponent of the asker
    if str(asker_id) == str(round.player1_id):
        expected_answerer = round.player2_id
    elif str(asker_id) == str(round.player2_id):
        expected_answerer = round.player1_id
    else:
        return False, "السائل ليس لاعباً"
    if str(participant.id) != str(expected_answerer):
        return False, "فقط الخصم يستطيع الإجابة"
    return True, ""


def can_submit_guess(participant: Participant, round: Round) -> tuple[bool, str]:
    if round.status != RoundStatus.active:
        return False, "الجولة غير نشطة"
    if str(participant.id) not in [str(round.player1_id), str(round.player2_id)]:
        return False, "فقط اللاعبان يستطيعان التخمين"
    if str(participant.id) != str(round.current_turn_player_id):
        return False, "ليس دورك للتخمين الآن"
    return True, ""


def get_secret_animal_id_for_player(participant: Participant, round: Round) -> int | None:
    """Return the secret animal ID that belongs to this player. Used ONLY for win validation."""
    if str(participant.id) == str(round.player1_id):
        return round.player1_animal_id
    if str(participant.id) == str(round.player2_id):
        return round.player2_animal_id
    return None
