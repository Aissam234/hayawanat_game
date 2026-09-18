import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey,
    Enum as SAEnum, Text, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


def utcnow():
    return datetime.now(timezone.utc)


class RoomStatus(str, enum.Enum):
    waiting = "waiting"
    playing = "playing"
    finished = "finished"
    closed = "closed"


class ParticipantRole(str, enum.Enum):
    host = "host"
    player = "player"
    audience = "audience"


class RoundStatus(str, enum.Enum):
    active = "active"
    finished = "finished"
    cancelled = "cancelled"


class QuestionAnswer(str, enum.Enum):
    pending = "pending"
    yes = "yes"
    no = "no"
    invalid = "invalid"


class Room(Base):
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(10), unique=True, nullable=False, index=True)
    status = Column(SAEnum(RoomStatus), default=RoomStatus.waiting, nullable=False)
    host_participant_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    participants = relationship("Participant", back_populates="room", cascade="all, delete-orphan")
    rounds = relationship("Round", back_populates="room", cascade="all, delete-orphan")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    guest_uuid = Column(UUID(as_uuid=True), nullable=False, index=True)
    display_name = Column(String(50), nullable=False)
    role = Column(SAEnum(ParticipantRole), default=ParticipantRole.audience, nullable=False)
    is_connected = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    room = relationship("Room", back_populates="participants")


class Round(Base):
    __tablename__ = "rounds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    round_number = Column(Integer, nullable=False, default=1)
    player1_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    player2_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    player1_animal_id = Column(Integer, nullable=False)
    player2_animal_id = Column(Integer, nullable=False)
    current_turn_player_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=True)
    status = Column(SAEnum(RoundStatus), default=RoundStatus.active, nullable=False)
    winner_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=True)
    difficulty = Column(String(20), default="medium")
    question_count = Column(Integer, default=0)
    guess_count = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    room = relationship("Room", back_populates="rounds")
    player1 = relationship("Participant", foreign_keys=[player1_id])
    player2 = relationship("Participant", foreign_keys=[player2_id])
    current_turn_player = relationship("Participant", foreign_keys=[current_turn_player_id])
    winner = relationship("Participant", foreign_keys=[winner_id])
    questions = relationship("Question", back_populates="round", cascade="all, delete-orphan")
    guesses = relationship("Guess", back_populates="round", cascade="all, delete-orphan")
    events = relationship("GameEvent", back_populates="round", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round_id = Column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False)
    asker_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    answer = Column(SAEnum(QuestionAnswer), default=QuestionAnswer.pending, nullable=False)
    is_valid = Column(Boolean, default=True)
    answered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    round = relationship("Round", back_populates="questions")
    asker = relationship("Participant", foreign_keys=[asker_id])


class Guess(Base):
    __tablename__ = "guesses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round_id = Column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False)
    guesser_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    animal_id = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    guessed_at = Column(DateTime(timezone=True), default=utcnow)

    round = relationship("Round", back_populates="guesses")
    guesser = relationship("Participant", foreign_keys=[guesser_id])


class GameEvent(Base):
    __tablename__ = "game_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round_id = Column(UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    round = relationship("Round", back_populates="events")
