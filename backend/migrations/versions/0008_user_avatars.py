"""Persist account avatars; backfill existing accounts with the lion."""
from alembic import op
import sqlalchemy as sa
revision = '0008_user_avatars'
down_revision = '0007_match_series'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('avatar_id', sa.String(20), nullable=False, server_default='lion'))

def downgrade():
    op.drop_column('users', 'avatar_id')
