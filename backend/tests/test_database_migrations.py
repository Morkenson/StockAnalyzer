"""PostgreSQL migration integration tests.

These tests verify that all Alembic migrations run correctly against a real
PostgreSQL database, and specifically cover the production schema bugs fixed
in migration 0003 (DatatypeMismatch on UUID vs VARCHAR ids, ForeignKeyViolation
from a stale FK to the legacy 'users' table).

Run with:
    pytest -m integration

Requires the Docker Compose database to be up:
    docker compose up db -d

Override the connection URL:
    POSTGRES_TEST_URL=postgresql+psycopg://user:pass@host:5432/db pytest -m integration
"""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, text


_PG_BASE_URL = os.getenv(
    "POSTGRES_TEST_URL",
    "postgresql+psycopg://stockanalyzer:stockanalyzer@localhost:5432/stockanalyzer",
)
_TEST_DB = "stockanalyzer_migrationtest"
_TEST_DB_URL = _PG_BASE_URL.rsplit("/", 1)[0] + f"/{_TEST_DB}"


def _pg_available() -> bool:
    try:
        e = create_engine(_PG_BASE_URL, connect_args={"connect_timeout": 3})
        with e.connect():
            pass
        e.dispose()
        return True
    except Exception:
        return False


def _run_migrations(url: str) -> None:
    from alembic import command
    from alembic.config import Config

    db_dir = Path(__file__).resolve().parent.parent / "database"
    cfg = Config(str(db_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(db_dir / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")


def _create_test_db(admin_engine) -> None:
    with admin_engine.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {_TEST_DB}"))
        conn.execute(text(f"CREATE DATABASE {_TEST_DB}"))


def _drop_test_db(admin_engine) -> None:
    with admin_engine.connect() as conn:
        conn.execute(text(
            f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            f"WHERE datname = '{_TEST_DB}'"
        ))
        conn.execute(text(f"DROP DATABASE IF EXISTS {_TEST_DB}"))


requires_pg = pytest.mark.skipif(
    not _pg_available(),
    reason="PostgreSQL not reachable — run `docker compose up db -d` to enable integration tests",
)


# ---------------------------------------------------------------------------
# Fixture: fresh database (no pre-existing tables)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def fresh_pg_engine():
    admin = create_engine(_PG_BASE_URL, isolation_level="AUTOCOMMIT")
    _create_test_db(admin)
    try:
        _run_migrations(_TEST_DB_URL)
        eng = create_engine(_TEST_DB_URL)
        yield eng
        eng.dispose()
    finally:
        _drop_test_db(admin)
        admin.dispose()


# ---------------------------------------------------------------------------
# Fixture: legacy database (simulates the old SQL init script on Railway)
# ---------------------------------------------------------------------------

# Matches the schema that the old 01_stock_analyzer.sql init script created:
# native UUID ids on loans/watchlists/assets and a FK from loans.user_id to the
# old 'users' table (not 'app_users').  This is the exact production state that
# caused DatatypeMismatch and ForeignKeyViolation before migration 0003.
_LEGACY_SETUP_SQL = """
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(320) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    principal NUMERIC(12,2) NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL,
    loan_term INTEGER NOT NULL,
    monthly_payment NUMERIC(12,2) NOT NULL,
    total_amount_paid NUMERIC(12,2) NOT NULL,
    total_interest NUMERIC(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    symbol VARCHAR(16) NOT NULL,
    notes TEXT,
    added_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (watchlist_id, symbol)
);

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(80) NOT NULL,
    value NUMERIC(14,2) NOT NULL,
    institution VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
"""


@pytest.fixture(scope="module")
def legacy_pg_engine():
    admin = create_engine(_PG_BASE_URL, isolation_level="AUTOCOMMIT")
    _create_test_db(admin)
    try:
        leg = create_engine(_TEST_DB_URL)
        with leg.connect() as conn:
            conn.execute(text(_LEGACY_SETUP_SQL))
            conn.commit()
        _run_migrations(_TEST_DB_URL)
        yield leg
        leg.dispose()
    finally:
        _drop_test_db(admin)
        admin.dispose()


# ---------------------------------------------------------------------------
# Tests: fresh database
# ---------------------------------------------------------------------------

@pytest.mark.integration
@requires_pg
class TestFreshMigrations:
    def test_all_expected_tables_exist(self, fresh_pg_engine):
        tables = set(inspect(fresh_pg_engine).get_table_names())
        required = {
            "app_users", "loans", "assets", "watchlists", "watchlist_items",
            "signin_otps", "password_reset_tokens", "plaid_items", "plaid_accounts",
            "cashflow_entries", "snaptrade_user_secrets", "snaptrade_account_preferences",
            "snaptrade_portfolio_balance_snapshots", "snaptrade_account_balance_snapshots", "alembic_version",
            "real_estate_properties", "external_api_usage", "rentcast_listing_cache",
        }
        assert required <= tables

    def test_all_id_and_user_id_columns_are_uuid(self, fresh_pg_engine):
        inspector = inspect(fresh_pg_engine)
        checks = [
            ("app_users", "id"),
            ("loans", "id"), ("loans", "user_id"),
            ("watchlists", "id"), ("watchlists", "user_id"),
            ("assets", "id"), ("assets", "user_id"),
            ("password_reset_tokens", "id"), ("password_reset_tokens", "user_id"),
            ("signin_otps", "id"), ("signin_otps", "user_id"),
            ("plaid_items", "id"), ("plaid_items", "user_id"),
            ("plaid_accounts", "id"), ("plaid_accounts", "user_id"),
            ("cashflow_entries", "id"), ("cashflow_entries", "user_id"),
            ("real_estate_properties", "id"), ("real_estate_properties", "user_id"),
        ]
        mismatches = []
        for table, col in checks:
            cols = {c["name"]: c for c in inspector.get_columns(table)}
            if col in cols and str(cols[col]["type"]).upper() != "UUID":
                mismatches.append(f"{table}.{col} = {cols[col]['type']}")
        assert not mismatches, f"Non-UUID id/user_id columns found: {mismatches}"

    def test_create_user_and_loan_succeeds(self, fresh_pg_engine):
        """Regression: the full flow that failed on Railway."""
        user_id, loan_id = str(uuid4()), str(uuid4())
        with fresh_pg_engine.connect() as conn:
            conn.execute(text(
                "INSERT INTO app_users (id, email, password_hash, token_version) "
                "VALUES (:id::uuid, :email, :pw, 0)"
            ), {"id": user_id, "email": "fresh@example.com", "pw": "hash"})
            conn.execute(text(
                "INSERT INTO loans (id, user_id, name, principal, interest_rate, "
                "loan_term, monthly_payment, total_amount_paid, total_interest) "
                "VALUES (:id::uuid, :uid::uuid, 'Test Loan', 10000, 5.0, 60, 188.71, 11322.74, 1322.74)"
            ), {"id": loan_id, "uid": user_id})
            row = conn.execute(
                text("SELECT name FROM loans WHERE id = :id::uuid"), {"id": loan_id}
            ).fetchone()
            conn.commit()
        assert row is not None and row[0] == "Test Loan"

    def test_create_watchlist_succeeds(self, fresh_pg_engine):
        user_id, wl_id = str(uuid4()), str(uuid4())
        with fresh_pg_engine.connect() as conn:
            conn.execute(text(
                "INSERT INTO app_users (id, email, password_hash, token_version) "
                "VALUES (:id::uuid, :email, :pw, 0)"
            ), {"id": user_id, "email": f"wl_{user_id[:8]}@example.com", "pw": "hash"})
            conn.execute(text(
                "INSERT INTO watchlists (id, user_id, name, is_default) "
                "VALUES (:id::uuid, :uid::uuid, 'My Watchlist', FALSE)"
            ), {"id": wl_id, "uid": user_id})
            row = conn.execute(
                text("SELECT name FROM watchlists WHERE id = :id::uuid"), {"id": wl_id}
            ).fetchone()
            conn.commit()
        assert row is not None and row[0] == "My Watchlist"


# ---------------------------------------------------------------------------
# Tests: legacy database (the exact Railway production scenario)
# ---------------------------------------------------------------------------

@pytest.mark.integration
@requires_pg
class TestLegacyMigrations:
    """Simulates the Railway production state: old tables with UUID ids and a
    stale FK from loans.user_id to the old 'users' table.  Each test
    corresponds directly to a production bug we fixed."""

    def test_migrations_complete_without_error(self, legacy_pg_engine):
        assert "app_users" in set(inspect(legacy_pg_engine).get_table_names())
        assert "alembic_version" in set(inspect(legacy_pg_engine).get_table_names())

    def test_app_users_id_converted_to_uuid(self, legacy_pg_engine):
        """Migration 0003: app_users.id was VARCHAR(36) from Alembic baseline,
        must be converted to UUID so GUID() TypeDecorator works."""
        cols = {c["name"]: c for c in inspect(legacy_pg_engine).get_columns("app_users")}
        assert str(cols["id"]["type"]).upper() == "UUID", (
            f"app_users.id is still {cols['id']['type']} — migration 0003 did not convert it"
        )

    def test_stale_loans_fk_to_users_is_dropped(self, legacy_pg_engine):
        """Migration 0003: the FK loans_user_id_fkey → 'users' must be dropped.
        This FK caused ForeignKeyViolation on every loan INSERT in production."""
        with legacy_pg_engine.connect() as conn:
            row = conn.execute(text(
                """
                SELECT rc.constraint_name
                FROM information_schema.referential_constraints rc
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = rc.unique_constraint_name
                WHERE rc.constraint_name = 'loans_user_id_fkey'
                  AND ccu.table_name = 'users'
                """
            )).fetchone()
        assert row is None, (
            "loans_user_id_fkey still references 'users' — migration 0003 did not drop it"
        )

    def test_insert_loan_for_app_users_user_succeeds(self, legacy_pg_engine):
        """The core regression test: after migrations, inserting a loan for an
        app_users user must succeed without ForeignKeyViolation or DatatypeMismatch.
        This is the exact request that returned HTTP 500 on Railway."""
        user_id, loan_id = str(uuid4()), str(uuid4())
        with legacy_pg_engine.connect() as conn:
            conn.execute(text(
                "INSERT INTO app_users (id, email, password_hash, token_version) "
                "VALUES (:id::uuid, :email, :pw, 0)"
            ), {"id": user_id, "email": "legacy@example.com", "pw": "hash"})
            conn.execute(text(
                "INSERT INTO loans (id, user_id, name, principal, interest_rate, "
                "loan_term, monthly_payment, total_amount_paid, total_interest) "
                "VALUES (:id::uuid, :uid::uuid, 'Legacy Loan', 5000, 4.5, 36, 148.22, 5336.00, 336.00)"
            ), {"id": loan_id, "uid": user_id})
            row = conn.execute(
                text("SELECT name FROM loans WHERE id = :id::uuid"), {"id": loan_id}
            ).fetchone()
            conn.commit()
        assert row is not None and row[0] == "Legacy Loan"

    def test_insert_watchlist_succeeds(self, legacy_pg_engine):
        """watchlists.id was UUID from old script — DatatypeMismatch if ROW_ID
        was still String(36).  Verifies migration 0003 did not break it."""
        user_id, wl_id = str(uuid4()), str(uuid4())
        with legacy_pg_engine.connect() as conn:
            conn.execute(text(
                "INSERT INTO app_users (id, email, password_hash, token_version) "
                "VALUES (:id::uuid, :email, :pw, 0)"
            ), {"id": user_id, "email": f"wl_{user_id[:8]}@example.com", "pw": "hash"})
            conn.execute(text(
                "INSERT INTO watchlists (id, user_id, name, is_default) "
                "VALUES (:id::uuid, :uid::uuid, 'Legacy Watchlist', FALSE)"
            ), {"id": wl_id, "uid": user_id})
            row = conn.execute(
                text("SELECT name FROM watchlists WHERE id = :id::uuid"), {"id": wl_id}
            ).fetchone()
            conn.commit()
        assert row is not None and row[0] == "Legacy Watchlist"
