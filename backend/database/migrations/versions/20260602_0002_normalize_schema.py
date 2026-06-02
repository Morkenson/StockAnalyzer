"""Normalize legacy schema drift.

Revision ID: 20260602_0002
Revises: 20260602_0001
Create Date: 2026-06-02
"""

from alembic import op

revision = "20260602_0002"
down_revision = "20260602_0001"
branch_labels = None
depends_on = None


NOT_NULL_COLUMNS = {
    "app_users": ("email", "password_hash", "token_version"),
    "password_reset_tokens": ("user_id", "token_hash", "expires_at"),
    "loans": (
        "user_id",
        "name",
        "principal",
        "interest_rate",
        "loan_term",
        "monthly_payment",
        "total_amount_paid",
        "total_interest",
    ),
    "assets": ("user_id", "name", "asset_type", "value"),
    "watchlists": ("user_id", "name", "is_default"),
    "watchlist_items": ("watchlist_id", "symbol"),
    "signin_otps": ("user_id", "code_hash", "expires_at", "attempts"),
    "snaptrade_user_secrets": ("user_id", "user_secret"),
    "snaptrade_account_preferences": ("user_id", "account_id", "hidden"),
    "snaptrade_dividend_preferences": (
        "user_id",
        "symbol",
        "currency",
        "payment_frequency",
        "payments_per_year",
        "hidden",
    ),
    "snaptrade_recurring_investment_preferences": ("user_id", "account_id", "symbol", "currency", "hidden"),
    "snaptrade_portfolio_balance_snapshots": ("user_id", "snapshot_date", "total_balance"),
    "plaid_items": ("user_id", "plaid_item_id", "access_token_encrypted"),
    "plaid_accounts": ("user_id", "item_id", "plaid_account_id", "name", "type", "hidden"),
    "cashflow_entries": ("user_id", "source", "type", "name", "category", "amount", "date", "pending"),
}

BOOLEAN_DEFAULTS = {
    "watchlists": ("is_default",),
    "snaptrade_account_preferences": ("hidden",),
    "snaptrade_dividend_preferences": ("hidden",),
    "snaptrade_recurring_investment_preferences": ("hidden",),
    "plaid_accounts": ("hidden",),
    "cashflow_entries": ("pending",),
}

TEXT_DEFAULTS = {
    "snaptrade_dividend_preferences": {"currency": "USD"},
    "snaptrade_recurring_investment_preferences": {"currency": "USD"},
    "snaptrade_portfolio_balance_snapshots": {"currency": "USD"},
    "cashflow_entries": {"source": "manual"},
}

NUMERIC_DEFAULTS = {
    "snaptrade_portfolio_balance_snapshots": {
        "total_gain_loss": "0",
        "total_gain_loss_percent": "0",
        "account_count": "0",
    },
    "signin_otps": {"attempts": "0"},
    "app_users": {"token_version": "0"},
}


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    _ensure_legacy_columns()
    _normalize_defaults()
    _normalize_not_null_constraints()


def downgrade() -> None:
    pass


def _ensure_legacy_columns() -> None:
    op.execute(
        """
        ALTER TABLE app_users
        ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0
        """
    )
    op.execute(
        """
        ALTER TABLE app_users
        ADD COLUMN IF NOT EXISTS otp_verified_until TIMESTAMP WITH TIME ZONE
        """
    )
    op.execute(
        """
        ALTER TABLE snaptrade_dividend_preferences
        ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE
        """
    )
    op.execute(
        """
        ALTER TABLE snaptrade_account_preferences
        ADD COLUMN IF NOT EXISTS margin_balance NUMERIC(14, 2)
        """
    )
    op.execute(
        """
        ALTER TABLE snaptrade_account_preferences
        ADD COLUMN IF NOT EXISTS margin_interest_rate NUMERIC(8, 4)
        """
    )


def _normalize_defaults() -> None:
    for table_name, columns in BOOLEAN_DEFAULTS.items():
        for column_name in columns:
            _set_default(table_name, column_name, "FALSE")
            _fill_null(table_name, column_name, "FALSE")

    for table_name, columns in TEXT_DEFAULTS.items():
        for column_name, value in columns.items():
            quoted = "'" + value.replace("'", "''") + "'"
            _set_default(table_name, column_name, quoted)
            _fill_null(table_name, column_name, quoted)

    for table_name, columns in NUMERIC_DEFAULTS.items():
        for column_name, value in columns.items():
            _set_default(table_name, column_name, value)
            _fill_null(table_name, column_name, value)


def _normalize_not_null_constraints() -> None:
    for table_name, columns in NOT_NULL_COLUMNS.items():
        for column_name in columns:
            op.execute(
                f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = '{table_name}'
                          AND column_name = '{column_name}'
                          AND is_nullable = 'YES'
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM {table_name} WHERE {column_name} IS NULL
                    ) THEN
                        ALTER TABLE {table_name} ALTER COLUMN {column_name} SET NOT NULL;
                    END IF;
                END $$;
                """
            )


def _set_default(table_name: str, column_name: str, value: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = '{table_name}'
                  AND column_name = '{column_name}'
            ) THEN
                ALTER TABLE {table_name} ALTER COLUMN {column_name} SET DEFAULT {value};
            END IF;
        END $$;
        """
    )


def _fill_null(table_name: str, column_name: str, value: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = '{table_name}'
                  AND column_name = '{column_name}'
            ) THEN
                UPDATE {table_name} SET {column_name} = {value} WHERE {column_name} IS NULL;
            END IF;
        END $$;
        """
    )
