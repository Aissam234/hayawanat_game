"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-17

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums will be created automatically by SQLAlchemy via the Column definitions.

    # rooms
    op.create_table(
        "rooms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(10), nullable=False, unique=True),
        sa.Column("status", sa.Enum("waiting", "playing", "finished", name="roomstatus"), nullable=False, server_default="waiting"),
        sa.Column("host_participant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_rooms_code", "rooms", ["code"])

    # participants
    op.create_table(
        "participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("guest_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.String(50), nullable=False),
        sa.Column("role", sa.Enum("host", "player", "audience", name="participantrole"), nullable=False, server_default="audience"),
        sa.Column("is_connected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_participants_guest_uuid", "participants", ["guest_uuid"])
    op.create_index("ix_participants_room_id", "participants", ["room_id"])

    # rounds
    op.create_table(
        "rounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("player1_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("participants.id"), nullable=False),
        sa.Column("player2_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("participants.id"), nullable=False),
        sa.Column("player1_animal_id", sa.Integer(), nullable=False),
        sa.Column("player2_animal_id", sa.Integer(), nullable=False),
        sa.Column("current_turn_player_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("participants.id"), nullable=True),
        sa.Column("status", sa.Enum("active", "finished", name="roundstatus"), nullable=False, server_default="active"),
        sa.Column("winner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("participants.id"), nullable=True),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("guess_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_rounds_room_id", "rounds", ["room_id"])

    # questions
    op.create_table(
        "questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("round_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asker_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("participants.id"), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("answer", sa.Enum("pending", "yes", "no", "invalid", name="questionanswer"), nullable=False, server_default="pending"),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_questions_round_id", "questions", ["round_id"])

    # guesses
    op.create_table(
        "guesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("round_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("guesser_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("participants.id"), nullable=False),
        sa.Column("animal_id", sa.Integer(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("guessed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_guesses_round_id", "guesses", ["round_id"])

    # game_events
    op.create_table(
        "game_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("round_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_game_events_round_id", "game_events", ["round_id"])


def downgrade() -> None:
    op.drop_table("game_events")
    op.drop_table("guesses")
    op.drop_table("questions")
    op.drop_table("rounds")
    op.drop_table("participants")
    op.drop_table("rooms")

    op.execute("DROP TYPE IF EXISTS questionanswer")
    op.execute("DROP TYPE IF EXISTS roundstatus")
    op.execute("DROP TYPE IF EXISTS participantrole")
    op.execute("DROP TYPE IF EXISTS roomstatus")
