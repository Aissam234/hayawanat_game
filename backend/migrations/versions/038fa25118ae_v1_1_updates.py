"""v1.1_updates

Revision ID: 038fa25118ae
Revises: 0001_initial
Create Date: 2026-09-17 06:43:46.361750

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '038fa25118ae'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cannot drop enum values in Postgres easily, so downgrade does nothing for these.
    # Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in some contexts,
    # but Postgres 12+ allows it if the type was created in a previous transaction.
    op.execute("ALTER TYPE roomstatus ADD VALUE IF NOT EXISTS 'closed'")
    op.execute("ALTER TYPE roundstatus ADD VALUE IF NOT EXISTS 'cancelled'")
    op.add_column('participants', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))

def downgrade() -> None:
    op.drop_column('participants', 'is_active')
