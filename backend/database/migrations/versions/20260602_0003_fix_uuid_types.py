"""Convert VARCHAR id columns to UUID and drop stale foreign keys.

Tables created by the Alembic baseline migration used String(36)/VARCHAR for
id and user_id columns, while the old SQL init script created loans/watchlists/
assets with native UUID ids.  This migration normalises everything to UUID so
the GUID() TypeDecorator in db_models.py works consistently on PostgreSQL.

It also drops the stale FK constraints on old tables that still point to the
legacy "users" table (replaced by "app_users").

Revision ID: 20260602_0003
Revises: 20260602_0002
Create Date: 2026-06-02
"""

from alembic import op

revision = "20260602_0003"
down_revision = "20260602_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    _drop_stale_user_fks()
    _drop_app_users_dependent_fks()
    _convert_varchar_ids_to_uuid()
    _recreate_app_users_fks()


def downgrade() -> None:
    pass


def _drop_stale_user_fks() -> None:
    """Drop FK constraints on old tables that reference the legacy 'users' table."""
    for table, constraint in [
        ("loans", "loans_user_id_fkey"),
        ("watchlists", "watchlists_user_id_fkey"),
        ("assets", "assets_user_id_fkey"),
    ]:
        op.execute(
            f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_schema = current_schema()
                      AND table_name = '{table}'
                      AND constraint_name = '{constraint}'
                ) THEN
                    ALTER TABLE {table} DROP CONSTRAINT {constraint};
                END IF;
            END $$;
            """
        )


def _drop_app_users_dependent_fks() -> None:
    """Drop FK constraints that reference app_users.id or plaid_items.id before altering types."""
    constraints = [
        ("password_reset_tokens", "password_reset_tokens_user_id_fkey"),
        ("signin_otps", "signin_otps_user_id_fkey"),
        ("plaid_items", "plaid_items_user_id_fkey"),
        ("plaid_accounts", "plaid_accounts_user_id_fkey"),
        ("plaid_accounts", "plaid_accounts_item_id_fkey"),
        ("cashflow_entries", "cashflow_entries_user_id_fkey"),
    ]
    for table, constraint in constraints:
        op.execute(
            f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_schema = current_schema()
                      AND table_name = '{table}'
                      AND constraint_name = '{constraint}'
                ) THEN
                    ALTER TABLE {table} DROP CONSTRAINT {constraint};
                END IF;
            END $$;
            """
        )


def _convert_col(table: str, column: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = '{table}'
                  AND column_name = '{column}'
                  AND data_type = 'character varying'
            ) THEN
                ALTER TABLE {table} ALTER COLUMN {column} TYPE UUID USING {column}::uuid;
            END IF;
        END $$;
        """
    )


def _convert_varchar_ids_to_uuid() -> None:
    conversions = [
        ("app_users", "id"),
        ("password_reset_tokens", "id"),
        ("password_reset_tokens", "user_id"),
        ("signin_otps", "id"),
        ("signin_otps", "user_id"),
        ("plaid_items", "id"),
        ("plaid_items", "user_id"),
        ("plaid_accounts", "id"),
        ("plaid_accounts", "user_id"),
        ("plaid_accounts", "item_id"),
        ("cashflow_entries", "id"),
        ("cashflow_entries", "user_id"),
        ("snaptrade_portfolio_balance_snapshots", "id"),
    ]
    for table, column in conversions:
        _convert_col(table, column)


def _recreate_app_users_fks() -> None:
    """Recreate FK constraints now that all columns are UUID."""
    fks = [
        (
            "password_reset_tokens",
            "password_reset_tokens_user_id_fkey",
            "user_id",
            "app_users",
            "id",
        ),
        (
            "signin_otps",
            "signin_otps_user_id_fkey",
            "user_id",
            "app_users",
            "id",
        ),
        (
            "plaid_items",
            "plaid_items_user_id_fkey",
            "user_id",
            "app_users",
            "id",
        ),
        (
            "plaid_accounts",
            "plaid_accounts_user_id_fkey",
            "user_id",
            "app_users",
            "id",
        ),
        (
            "plaid_accounts",
            "plaid_accounts_item_id_fkey",
            "item_id",
            "plaid_items",
            "id",
        ),
        (
            "cashflow_entries",
            "cashflow_entries_user_id_fkey",
            "user_id",
            "app_users",
            "id",
        ),
    ]
    for table, constraint, col, ref_table, ref_col in fks:
        op.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_schema = current_schema()
                      AND table_name = '{table}'
                      AND constraint_name = '{constraint}'
                ) THEN
                    ALTER TABLE {table}
                        ADD CONSTRAINT {constraint}
                        FOREIGN KEY ({col}) REFERENCES {ref_table}({ref_col}) ON DELETE CASCADE;
                END IF;
            END $$;
            """
        )
