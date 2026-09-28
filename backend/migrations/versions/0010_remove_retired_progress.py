"""Remove retired server-side practice progress; offline games use no database."""
from alembic import op
import sqlalchemy as sa
revision = '0010_remove_retired_progress'
down_revision = '0009_solo_detective'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("UPDATE users SET avatar_id = 'lion' WHERE avatar_id IN ('detective','explorer','wizard','ninja','dragon')")
    op.drop_column('users', 'solo_round')
    op.drop_column('users', 'solo_stars')

def downgrade():
    op.add_column('users', sa.Column('solo_stars', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('solo_round', sa.JSON(), nullable=True))
