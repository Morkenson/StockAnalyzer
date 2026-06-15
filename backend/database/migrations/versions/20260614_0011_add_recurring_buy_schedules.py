"""Add SnapTrade recurring buy schedules.

Revision ID: 20260614_0011
Revises: 20260614_0010
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa

revision = "20260614_0011"
down_revision = "20260614_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    datetime_type = sa.DateTime(timezone=dialect == "postgresql")
    row_id_type = sa.UUID(as_uuid=False) if dialect == "postgresql" else sa.String(length=36)
    now_default = sa.text("CURRENT_TIMESTAMP")

    op.create_table(
        "snaptrade_recurring_buy_schedules",
        sa.Column("id", row_id_type, primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("account_id", sa.String(length=128), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("units", sa.Numeric(18, 6), nullable=False),
        sa.Column("frequency", sa.String(length=16), nullable=False),
        sa.Column("next_run_date", sa.Date(), nullable=False),
        sa.Column("last_run_date", sa.Date(), nullable=True),
        sa.Column("last_status", sa.String(length=255), nullable=True),
        sa.Column("last_order_id", sa.String(length=128), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1") if dialect == "sqlite" else sa.text("true")),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index(
        "idx_recurring_buy_schedules_user_id", "snaptrade_recurring_buy_schedules", ["user_id"], if_not_exists=True
    )
    op.create_index(
        "idx_recurring_buy_schedules_next_run", "snaptrade_recurring_buy_schedules", ["next_run_date"], if_not_exists=True
    )


def downgrade() -> None:
    op.drop_index("idx_recurring_buy_schedules_next_run", table_name="snaptrade_recurring_buy_schedules", if_exists=True)
    op.drop_index("idx_recurring_buy_schedules_user_id", table_name="snaptrade_recurring_buy_schedules", if_exists=True)
    op.drop_table("snaptrade_recurring_buy_schedules", if_exists=True)
