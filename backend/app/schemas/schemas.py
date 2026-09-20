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
    score: int = 0

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


# ============ Game Settings Schemas ============

class GameSettingsRequest(BaseModel):
    difficulty: Optional[str] = None            # easy | medium | hard | random
    timer_duration: Optional[int] = None        # seconds; None = no timer
    max_questions: Optional[int] = None         # None = unlimited
    allow_repeated: Optional[bool] = None
    reactions_enabled: Optional[bool] = None


class GameSettingsOut(BaseModel):
    difficulty: str
    timer_duration: Optional[int]
    max_questions: Optional[int]
    allow_repeated: bool
    reactions_enabled: bool


# ============ Round Schemas ============

class StartRoundRequest(BaseModel):
    player1_id: uuid.UUID
    player2_id: uuid.UUID
    difficulty: str = "medium"   # kept for backward-compat; settings panel overrides this


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
    timer_duration: Optional[int] = None
    timer_started_at: Optional[datetime] = None
    max_questions: Optional[int] = None
    reactions_enabled: bool = True

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


# ============ Scoreboard ============

class ScoreboardEntry(BaseModel):
    participant_id: str
    display_name: str
    score: int


# ============ Common ============

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


class SuccessResponse(BaseModel):
    message: str
