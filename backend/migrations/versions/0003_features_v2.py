"""features_v2: live reactions rate-limit, round timer, host settings, scoreboard

Revision ID: 0003_features_v2
Revises: 038fa25118ae
Create Date: 2026-09-20

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003_features_v2"
down_revision: Union[str, None] = "038fa25118ae"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- participants: add lifetime room score ---
    op.add_column(
        "participants",
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
    )

    # --- rounds: add timer / settings / cancellation-reason columns ---
    op.add_column("rounds", sa.Column("timer_duration", sa.Integer(), nullable=True))
    op.add_column("rounds", sa.Column("timer_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("rounds", sa.Column("max_questions", sa.Integer(), nullable=True))
    op.add_column("rounds", sa.Column("allow_repeated", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("rounds", sa.Column("reactions_enabled", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("rounds", sa.Column("cancelled_reason", sa.String(30), nullable=True))

    # --- room_settings: persisted host defaults per room ---
    op.create_table(
        "room_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "room_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rooms.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("timer_duration", sa.Integer(), nullable=True),
        sa.Column("max_questions", sa.Integer(), nullable=True),
        sa.Column("allow_repeated", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("reactions_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default="medium"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("ix_room_settings_room_id", "room_settings", ["room_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_room_settings_room_id", table_name="room_settings")
    op.drop_table("room_settings")
    op.drop_column("rounds", "cancelled_reason")
    op.drop_column("rounds", "reactions_enabled")
    op.drop_column("rounds", "allow_repeated")
    op.drop_column("rounds", "max_questions")
    op.drop_column("rounds", "timer_started_at")
    op.drop_column("rounds", "timer_duration")
    op.drop_column("participants", "score")
