"""Persistent solo progress and resumable rounds."""
from alembic import op
import sqlalchemy as sa
revision = '0009_solo_detective'
down_revision = '0008_user_avatars'
branch_labels = None
depends_on = None
def upgrade():
    op.add_column('users', sa.Column('solo_stars', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('solo_round', sa.JSON(), nullable=True))
def downgrade():
    op.drop_column('users', 'solo_round')
    op.drop_column('users', 'solo_stars')
