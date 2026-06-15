"""Add dollar-cost target columns to recurring buy schedules.

Revision ID: 20260615_0012
Revises: 20260614_0011
Create Date: 2026-06-15
"""

from alembic import op
import sqlalchemy as sa

revision = "20260615_0012"
down_revision = "20260614_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table keeps this portable: real ALTERs on PostgreSQL, table-rebuild on SQLite
    # (SQLite can't ALTER a column to drop NOT NULL directly).
    with op.batch_alter_table("snaptrade_recurring_buy_schedules") as batch:
        batch.add_column(sa.Column("target_amount", sa.Numeric(14, 2), nullable=True))
        batch.add_column(sa.Column("accumulated_budget", sa.Numeric(14, 2), nullable=False, server_default="0"))
        # Dollar-mode schedules leave units NULL, so the column can no longer be NOT NULL.
        batch.alter_column("units", existing_type=sa.Numeric(18, 6), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("snaptrade_recurring_buy_schedules") as batch:
        batch.alter_column("units", existing_type=sa.Numeric(18, 6), nullable=False)
        batch.drop_column("accumulated_budget")
        batch.drop_column("target_amount")
