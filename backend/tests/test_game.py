"""
Basic backend tests.
"""
import pytest
from app.game.animals import ANIMALS, ANIMALS_BY_ID, get_animal, get_animal_dict
from app.game.permissions import get_secret_animal_id_for_player
from app.services.room_service import generate_room_code


def test_animal_dataset():
    """Ensure we have enough animals in each difficulty."""
    easy = [a for a in ANIMALS if a.difficulty == "easy"]
    medium = [a for a in ANIMALS if a.difficulty == "medium"]
    hard = [a for a in ANIMALS if a.difficulty == "hard"]
    assert len(easy) >= 10, f"Need at least 10 easy animals, got {len(easy)}"
    assert len(medium) >= 15, f"Need at least 15 medium animals, got {len(medium)}"
    assert len(hard) >= 10, f"Need at least 10 hard animals, got {len(hard)}"
    assert len(ANIMALS) >= 40


def test_animal_ids_unique():
    """All animal IDs must be unique."""
    ids = [a.id for a in ANIMALS]
    assert len(ids) == len(set(ids)), "Duplicate animal IDs detected!"


def test_get_animal():
    a = get_animal(1)
    assert a is not None
    assert a.name_ar


def test_get_animal_dict():
    d = get_animal_dict(1)
    assert d is not None
    assert "id" in d
    assert "name_ar" in d
    assert "emoji" in d
    # Must NOT include sensitive game info
    assert "player" not in d
    assert "secret" not in d


def test_get_animal_nonexistent():
    assert get_animal(9999) is None
    assert get_animal_dict(9999) is None


def test_room_code_generation():
    code = generate_room_code()
    assert len(code) == 5
    assert code.isupper() or code.isdigit() or any(c.isdigit() for c in code)
    # No ambiguous chars
    assert "0" not in code
    assert "O" not in code
    assert "I" not in code
    assert "1" not in code


def test_room_code_unique_per_call():
    codes = {generate_room_code() for _ in range(100)}
    # Very unlikely to have <50 unique codes in 100 attempts
    assert len(codes) > 50


class MockRound:
    def __init__(self, p1_id, p2_id, p1_animal, p2_animal):
        self.player1_id = p1_id
        self.player2_id = p2_id
        self.player1_animal_id = p1_animal
        self.player2_animal_id = p2_animal


class MockParticipant:
    def __init__(self, pid):
        self.id = pid


def test_secret_animal_not_leaked():
    """
    Core security test: a player only gets their own secret animal ID
    when calling get_secret_animal_id_for_player, never the opponent's.
    The serializer uses opponent_animal, not my_animal.
    """
    p1 = MockParticipant("player1-uuid")
    p2 = MockParticipant("player2-uuid")
    round_ = MockRound("player1-uuid", "player2-uuid", animal1 := 16, animal2 := 41)

    # Player 1's secret is animal1 (giraffe) — used for guess validation ONLY
    assert get_secret_animal_id_for_player(p1, round_) == animal1
    # Player 2's secret is animal2 (crocodile)
    assert get_secret_animal_id_for_player(p2, round_) == animal2

    # Non-player gets None
    audience = MockParticipant("audience-uuid")
    assert get_secret_animal_id_for_player(audience, round_) is None
