"""more preferences

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-07 21:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("preferences") as batch_op:
        batch_op.add_column(
            sa.Column(
                "notify_about",
                sa.Enum("ALL", "BREAKING", name="notifyabout", native_enum=False, length=8),
                nullable=False,
                server_default="ALL",
            )
        )
        batch_op.add_column(
            sa.Column(
                "mark_read_after_viewing", sa.Boolean(), nullable=False, server_default=sa.false()
            )
        )
        batch_op.add_column(
            sa.Column("app_badge", sa.Boolean(), nullable=False, server_default=sa.true())
        )


def downgrade() -> None:
    with op.batch_alter_table("preferences") as batch_op:
        batch_op.drop_column("app_badge")
        batch_op.drop_column("mark_read_after_viewing")
        batch_op.drop_column("notify_about")
