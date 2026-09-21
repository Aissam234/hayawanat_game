"""Add Google identity without changing existing accounts or scores."""
from alembic import op
import sqlalchemy as sa
revision = '0006_google_accounts'
down_revision = 'dd6b0f5693b7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('google_subject', sa.String(255), nullable=True))
    op.create_index('ix_users_google_subject', 'users', ['google_subject'], unique=True)
    op.add_column('users', sa.Column('display_name', sa.String(50), nullable=True))
    op.alter_column('users', 'password_hash', existing_type=sa.String(255), nullable=True)


def downgrade():
    # Empty hashes cannot authenticate, but retain Google-only account scores.
    op.execute("UPDATE users SET password_hash = '' WHERE password_hash IS NULL")
    op.alter_column('users', 'password_hash', existing_type=sa.String(255), nullable=False)
    op.drop_column('users', 'display_name')
    op.drop_index('ix_users_google_subject', table_name='users')
    op.drop_column('users', 'google_subject')
