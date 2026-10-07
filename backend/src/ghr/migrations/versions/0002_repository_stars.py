"""repository star counts

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-07 17:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import ghr.db

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("repositories") as batch_op:
        batch_op.add_column(sa.Column("stargazers_count", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("stars_etag", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("stars_checked_at", ghr.db.UtcDateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("repositories") as batch_op:
        batch_op.drop_column("stars_checked_at")
        batch_op.drop_column("stars_etag")
        batch_op.drop_column("stargazers_count")
