import uuid
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# ============ Room Schemas ============

class CreateRoomRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    guest_uuid: uuid.UUID


class JoinRoomRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    guest_uuid: uuid.UUID
    room_code: str = Field(..., min_length=3, max_length=10)


class ParticipantOut(BaseModel):
    id: uuid.UUID
    display_name: str
    role: str
    is_connected: bool

    class Config:
        from_attributes = True


class RoomOut(BaseModel):
    id: uuid.UUID
    code: str
    status: str
    host_participant_id: Optional[uuid.UUID]
    participants: list[ParticipantOut] = []

    class Config:
        from_attributes = True


# ============ Round Schemas ============

class StartRoundRequest(BaseModel):
    player1_id: uuid.UUID
    player2_id: uuid.UUID
    difficulty: str = "medium"  # easy | medium | hard | random


class RoundOut(BaseModel):
    id: uuid.UUID
    round_number: int
    player1_id: uuid.UUID
    player2_id: uuid.UUID
    current_turn_player_id: Optional[uuid.UUID]
    status: str
    difficulty: str
    question_count: int
    guess_count: int

    class Config:
        from_attributes = True


# ============ Question Schemas ============

class SubmitQuestionRequest(BaseModel):
    question_text: str = Field(..., min_length=1, max_length=300)


class AnswerQuestionRequest(BaseModel):
    answer: str  # yes | no | invalid


class QuestionOut(BaseModel):
    id: uuid.UUID
    asker_id: uuid.UUID
    asker_name: str
    question_text: str
    answer: str
    is_valid: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Guess Schemas ============

class SubmitGuessRequest(BaseModel):
    animal_id: int


class GuessOut(BaseModel):
    id: uuid.UUID
    guesser_id: uuid.UUID
    guesser_name: str
    animal_id: int
    is_correct: bool
    guessed_at: datetime

    class Config:
        from_attributes = True


# ============ Common ============

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


class SuccessResponse(BaseModel):
    message: str
