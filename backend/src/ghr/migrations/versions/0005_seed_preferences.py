"""seed preferences

The preferences are a single row. Creating it here, with the column defaults, means it always
exists: the app never has to insert it, so concurrent first changes can't collide.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-07 23:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "INSERT INTO preferences (id, prereleases) SELECT 1, 'SHOW' "
        "WHERE NOT EXISTS (SELECT 1 FROM preferences WHERE id = 1)"
    )


def downgrade() -> None:
    # The row may hold the user's choices; an older version reads it just as well.
    pass
