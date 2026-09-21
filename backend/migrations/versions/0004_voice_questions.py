"""Transient voice questions: metadata only, never audio bytes."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_voice_questions"
down_revision = "0003_features_v2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("questions", sa.Column("question_type", sa.String(10), nullable=False, server_default="text"))
    op.add_column("questions", sa.Column("audio_duration_ms", sa.Integer(), nullable=True))
    op.add_column("questions", sa.Column("client_request_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_unique_constraint("uq_question_client_request", "questions", ["client_request_id"])
    op.alter_column("questions", "question_text", existing_type=sa.Text(), nullable=True)
    op.create_check_constraint("ck_question_content", "questions", "(question_type = 'text' AND question_text IS NOT NULL AND audio_duration_ms IS NULL) OR (question_type = 'audio' AND question_text IS NULL AND audio_duration_ms BETWEEN 1 AND 12000 AND audio_duration_ms IS NOT NULL)")


def downgrade():
    op.drop_constraint("ck_question_content", "questions", type_="check")
    # Keep question/answer history readable if rolling back to text-only code.
    op.execute("UPDATE questions SET question_text = 'سؤال صوتي (التسجيل غير محفوظ)' WHERE question_text IS NULL")
    op.alter_column("questions", "question_text", existing_type=sa.Text(), nullable=False)
    op.drop_constraint("uq_question_client_request", "questions", type_="unique")
    op.drop_column("questions", "client_request_id")
    op.drop_column("questions", "audio_duration_ms")
    op.drop_column("questions", "question_type")
