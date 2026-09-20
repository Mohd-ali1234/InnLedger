"""add address column to bookings

Revision ID: 0001_add_booking_address
Revises:
Create Date: 2026-07-28

Tables are created by ``Base.metadata.create_all`` on startup, so a fresh database
already has the column. This migration exists to bring an *existing* room.db up to
date; it is a no-op when the column is already present.
"""

import sqlalchemy as sa
from alembic import op

revision = "0001_add_booking_address"
down_revision = None
branch_labels = None
depends_on = None


def _has_column(name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if "bookings" not in inspector.get_table_names():
        return True  # nothing to migrate yet
    return name in {col["name"] for col in inspector.get_columns("bookings")}


def upgrade() -> None:
    if not _has_column("address"):
        op.add_column("bookings", sa.Column("address", sa.String(length=255), nullable=True))


def downgrade() -> None:
    if _has_column("address"):
        with op.batch_alter_table("bookings") as batch_op:
            batch_op.drop_column("address")
