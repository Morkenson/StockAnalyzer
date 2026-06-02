"""Baseline schema and production schema repairs.

Revision ID: 20260602_0001
Revises:
Create Date: 2026-06-02
"""

from alembic import op
import sqlalchemy as sa

revision = "20260602_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    _create_baseline_tables(dialect)
    if dialect == "postgresql":
        _migrate_app_owned_user_ids_to_text()


def downgrade() -> None:
    pass


def _create_baseline_tables(dialect: str) -> None:
    datetime_type = sa.DateTime(timezone=dialect == "postgresql")
    now_default = sa.text("CURRENT_TIMESTAMP")

    op.create_table(
        "app_users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("otp_verified_until", datetime_type, nullable=True),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        sa.UniqueConstraint("email"),
        if_not_exists=True,
    )
    op.create_index("idx_app_users_email", "app_users", ["email"], unique=False, if_not_exists=True)

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", datetime_type, nullable=False),
        sa.Column("used_at", datetime_type, nullable=True),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.ForeignKeyConstraint(["user_id"], ["app_users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_hash"),
        if_not_exists=True,
    )
    op.create_index("idx_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"], if_not_exists=True)
    op.create_index("idx_password_reset_tokens_expires_at", "password_reset_tokens", ["expires_at"], if_not_exists=True)

    op.create_table(
        "loans",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("principal", sa.Numeric(12, 2), nullable=False),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("loan_term", sa.Integer(), nullable=False),
        sa.Column("monthly_payment", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_amount_paid", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_interest", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index("idx_loans_user_id", "loans", ["user_id"], if_not_exists=True)

    op.create_table(
        "assets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("asset_type", sa.String(length=80), nullable=False),
        sa.Column("value", sa.Numeric(14, 2), nullable=False),
        sa.Column("institution", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index("idx_assets_user_id", "assets", ["user_id"], if_not_exists=True)

    op.create_table(
        "watchlists",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index("idx_watchlists_user_id", "watchlists", ["user_id"], if_not_exists=True)

    op.create_table(
        "watchlist_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("watchlist_id", sa.String(length=36), nullable=False),
        sa.Column("symbol", sa.String(length=16), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("added_date", datetime_type, server_default=now_default),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        sa.ForeignKeyConstraint(["watchlist_id"], ["watchlists.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("watchlist_id", "symbol", name="uq_watchlist_symbol"),
        if_not_exists=True,
    )
    op.create_index("idx_watchlist_items_watchlist_id", "watchlist_items", ["watchlist_id"], if_not_exists=True)

    op.create_table(
        "signin_otps",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", datetime_type, nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.ForeignKeyConstraint(["user_id"], ["app_users.id"], ondelete="CASCADE"),
        if_not_exists=True,
    )
    op.create_index("idx_signin_otps_user_id", "signin_otps", ["user_id"], if_not_exists=True)
    op.create_index("idx_signin_otps_expires_at", "signin_otps", ["expires_at"], if_not_exists=True)

    op.create_table(
        "snaptrade_user_secrets",
        sa.Column("user_id", sa.String(length=128), primary_key=True),
        sa.Column("user_secret", sa.Text(), nullable=False),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )

    op.create_table(
        "snaptrade_account_preferences",
        sa.Column("user_id", sa.String(length=128), primary_key=True),
        sa.Column("account_id", sa.String(length=128), primary_key=True),
        sa.Column("nickname", sa.String(length=255), nullable=True),
        sa.Column("margin_balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("margin_interest_rate", sa.Numeric(8, 4), nullable=True),
        sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index("idx_snaptrade_account_preferences_user_id", "snaptrade_account_preferences", ["user_id"], if_not_exists=True)

    op.create_table(
        "snaptrade_dividend_preferences",
        sa.Column("user_id", sa.String(length=128), primary_key=True),
        sa.Column("symbol", sa.String(length=32), primary_key=True),
        sa.Column("currency", sa.String(length=8), primary_key=True, server_default="USD"),
        sa.Column("payment_frequency", sa.String(length=32), nullable=False),
        sa.Column("payments_per_year", sa.Numeric(8, 2), nullable=False),
        sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index("idx_snaptrade_dividend_preferences_user_id", "snaptrade_dividend_preferences", ["user_id"], if_not_exists=True)

    op.create_table(
        "snaptrade_recurring_investment_preferences",
        sa.Column("user_id", sa.String(length=128), primary_key=True),
        sa.Column("account_id", sa.String(length=128), primary_key=True),
        sa.Column("symbol", sa.String(length=32), primary_key=True),
        sa.Column("currency", sa.String(length=8), primary_key=True, server_default="USD"),
        sa.Column("amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("frequency", sa.String(length=32), nullable=True),
        sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        if_not_exists=True,
    )
    op.create_index("idx_snaptrade_recurring_investment_preferences_user_id", "snaptrade_recurring_investment_preferences", ["user_id"], if_not_exists=True)

    op.create_table(
        "snaptrade_portfolio_balance_snapshots",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("total_balance", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_gain_loss", sa.Numeric(14, 2), server_default="0"),
        sa.Column("total_gain_loss_percent", sa.Numeric(10, 4), server_default="0"),
        sa.Column("account_count", sa.Integer(), server_default="0"),
        sa.Column("currency", sa.String(length=8), server_default="USD"),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        sa.UniqueConstraint("user_id", "snapshot_date", name="uq_snaptrade_portfolio_snapshot_user_date"),
        if_not_exists=True,
    )
    op.create_index("idx_snaptrade_portfolio_balance_snapshots_user_id", "snaptrade_portfolio_balance_snapshots", ["user_id"], if_not_exists=True)
    op.create_index("idx_snaptrade_portfolio_balance_snapshots_snapshot_date", "snaptrade_portfolio_balance_snapshots", ["snapshot_date"], if_not_exists=True)

    op.create_table(
        "plaid_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("plaid_item_id", sa.String(length=128), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=False),
        sa.Column("transaction_cursor", sa.Text(), nullable=True),
        sa.Column("institution_id", sa.String(length=128), nullable=True),
        sa.Column("institution_name", sa.String(length=255), nullable=True),
        sa.Column("last_sync_started_at", datetime_type, nullable=True),
        sa.Column("last_sync_at", datetime_type, nullable=True),
        sa.Column("last_sync_error", sa.Text(), nullable=True),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        sa.ForeignKeyConstraint(["user_id"], ["app_users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "plaid_item_id", name="uq_plaid_item_user_item"),
        if_not_exists=True,
    )
    op.create_index("idx_plaid_items_user_id", "plaid_items", ["user_id"], if_not_exists=True)
    op.create_index("idx_plaid_items_plaid_item_id", "plaid_items", ["plaid_item_id"], if_not_exists=True)

    op.create_table(
        "plaid_accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("item_id", sa.String(length=36), nullable=False),
        sa.Column("plaid_account_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("official_name", sa.String(length=255), nullable=True),
        sa.Column("mask", sa.String(length=16), nullable=True),
        sa.Column("type", sa.String(length=80), nullable=False),
        sa.Column("subtype", sa.String(length=80), nullable=True),
        sa.Column("current_balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("available_balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("iso_currency_code", sa.String(length=8), nullable=True),
        sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("balance_updated_at", datetime_type, nullable=True),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        sa.ForeignKeyConstraint(["item_id"], ["plaid_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["app_users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "plaid_account_id", name="uq_plaid_account_user_account"),
        if_not_exists=True,
    )
    op.create_index("idx_plaid_accounts_user_id", "plaid_accounts", ["user_id"], if_not_exists=True)
    op.create_index("idx_plaid_accounts_item_id", "plaid_accounts", ["item_id"], if_not_exists=True)
    op.create_index("idx_plaid_accounts_plaid_account_id", "plaid_accounts", ["plaid_account_id"], if_not_exists=True)

    op.create_table(
        "cashflow_entries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("source", sa.String(length=24), nullable=False, server_default="manual"),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("merchant_name", sa.String(length=255), nullable=True),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("plaid_item_id", sa.String(length=128), nullable=True),
        sa.Column("plaid_account_id", sa.String(length=128), nullable=True),
        sa.Column("plaid_transaction_id", sa.String(length=128), nullable=True),
        sa.Column("pending", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("removed_at", datetime_type, nullable=True),
        sa.Column("created_at", datetime_type, server_default=now_default),
        sa.Column("updated_at", datetime_type, server_default=now_default),
        sa.ForeignKeyConstraint(["user_id"], ["app_users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "plaid_transaction_id", name="uq_cashflow_user_plaid_transaction"),
        if_not_exists=True,
    )
    op.create_index("idx_cashflow_entries_user_id", "cashflow_entries", ["user_id"], if_not_exists=True)
    op.create_index("idx_cashflow_entries_source", "cashflow_entries", ["source"], if_not_exists=True)
    op.create_index("idx_cashflow_entries_date", "cashflow_entries", ["date"], if_not_exists=True)
    op.create_index("idx_cashflow_entries_plaid_transaction_id", "cashflow_entries", ["plaid_transaction_id"], if_not_exists=True)
    op.create_index("idx_cashflow_entries_removed_at", "cashflow_entries", ["removed_at"], if_not_exists=True)


def _migrate_app_owned_user_ids_to_text() -> None:
    for table_name in ("loans", "assets", "watchlists"):
        op.execute(
            f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = '{table_name}'
                      AND column_name = 'user_id'
                      AND udt_name = 'uuid'
                ) THEN
                    ALTER TABLE {table_name}
                    ALTER COLUMN user_id TYPE VARCHAR(128) USING user_id::text;
                END IF;
            END $$;
            """
        )
