"""Persist best-of-three match grouping."""
from alembic import op
import sqlalchemy as sa
revision = '0007_match_series'
down_revision = '0006_google_accounts'
branch_labels = None
depends_on = None
def upgrade():
    op.add_column('rounds', sa.Column('series_id', sa.UUID(), nullable=True))
    op.add_column('rounds', sa.Column('best_of', sa.Integer(), nullable=False, server_default='1'))
    op.create_index('ix_rounds_series_id', 'rounds', ['series_id'])
def downgrade():
    op.drop_index('ix_rounds_series_id', table_name='rounds')
    op.drop_column('rounds', 'best_of')
    op.drop_column('rounds', 'series_id')
