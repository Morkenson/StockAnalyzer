"""Add SnapTrade account balance snapshots.

Revision ID: 20260605_0005
Revises: 20260602_0004
Create Date: 2026-06-05
"""

from alembic import op
import sqlalchemy as sa

revision = "20260605_0005"
down_revision = "20260602_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    datetime_type = sa.DateTime(timezone=dialect == "postgresql")
    row_id_type = sa.UUID(as_uuid=False) if dialect == "postgresql" else sa.String(length=36)
    now_default = sa.text("CURRENT_TIMESTAMP")

    op.create_table(
        "snaptrade_account_balance_snapshots",
        sa.Column("id", row_id_type, primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("account_id", sa.String(length=128), nullable=False),
        sa.Column("account_name", sa.String(length=255), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("total_balance", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_gain_loss", sa.Numeric(14, 2), server_default="0"),
        sa.Column("total_gain_loss_percent", sa.Numeric(10, 4), server_default="0"),
        sa.Column("holding_count", sa.Integer(), server_default="0"),
        sa.Column("currency", sa.String(length=8), server_default="USD"),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        sa.UniqueConstraint("user_id", "account_id", "snapshot_date", name="uq_snaptrade_account_snapshot_user_account_date"),
        if_not_exists=True,
    )
    op.create_index("idx_snaptrade_account_balance_snapshots_user_id", "snaptrade_account_balance_snapshots", ["user_id"], if_not_exists=True)
    op.create_index("idx_snaptrade_account_balance_snapshots_account_id", "snaptrade_account_balance_snapshots", ["account_id"], if_not_exists=True)
    op.create_index("idx_snaptrade_account_balance_snapshots_snapshot_date", "snaptrade_account_balance_snapshots", ["snapshot_date"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("idx_snaptrade_account_balance_snapshots_snapshot_date", table_name="snaptrade_account_balance_snapshots", if_exists=True)
    op.drop_index("idx_snaptrade_account_balance_snapshots_account_id", table_name="snaptrade_account_balance_snapshots", if_exists=True)
    op.drop_index("idx_snaptrade_account_balance_snapshots_user_id", table_name="snaptrade_account_balance_snapshots", if_exists=True)
    op.drop_table("snaptrade_account_balance_snapshots", if_exists=True)
