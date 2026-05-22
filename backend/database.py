"""Database setup for normal PostgreSQL/SQLite connections."""
import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./stockanalyzer.db")
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _database_url()
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    import db_models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations()


def _apply_lightweight_migrations() -> None:
    inspector = inspect(engine)
    if "app_users" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("app_users")}
    if "token_version" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE app_users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"))
    if "otp_verified_until" not in columns:
        column_type = "DATETIME" if DATABASE_URL.startswith("sqlite") else "TIMESTAMP WITH TIME ZONE"
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE app_users ADD COLUMN otp_verified_until {column_type}"))

    table_names = set(inspector.get_table_names())
    if "snaptrade_dividend_preferences" in table_names:
        dividend_columns = {col["name"] for col in inspector.get_columns("snaptrade_dividend_preferences")}
        if "hidden" not in dividend_columns:
            bool_type = "BOOLEAN" if not DATABASE_URL.startswith("sqlite") else "BOOLEAN"
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE snaptrade_dividend_preferences "
                        f"ADD COLUMN hidden {bool_type} NOT NULL DEFAULT FALSE"
                    )
                )

    if "snaptrade_account_preferences" in table_names:
        account_columns = {col["name"] for col in inspector.get_columns("snaptrade_account_preferences")}
        if "margin_balance" not in account_columns:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE snaptrade_account_preferences "
                        "ADD COLUMN margin_balance NUMERIC(14, 2)"
                    )
                )
        if "margin_interest_rate" not in account_columns:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE snaptrade_account_preferences "
                        "ADD COLUMN margin_interest_rate NUMERIC(8, 4)"
                    )
                )

    if "snaptrade_recurring_investment_preferences" not in table_names:
        with engine.begin() as conn:
            if DATABASE_URL.startswith("sqlite"):
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS snaptrade_recurring_investment_preferences (
                            user_id VARCHAR(128) NOT NULL,
                            account_id VARCHAR(128) NOT NULL,
                            symbol VARCHAR(32) NOT NULL,
                            currency VARCHAR(8) NOT NULL DEFAULT 'USD',
                            amount NUMERIC(14, 2),
                            frequency VARCHAR(32),
                            hidden BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at DATETIME,
                            updated_at DATETIME,
                            PRIMARY KEY (user_id, account_id, symbol, currency)
                        )
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS snaptrade_recurring_investment_preferences (
                            user_id VARCHAR(128) NOT NULL,
                            account_id VARCHAR(128) NOT NULL,
                            symbol VARCHAR(32) NOT NULL,
                            currency VARCHAR(8) NOT NULL DEFAULT 'USD',
                            amount NUMERIC(14, 2),
                            frequency VARCHAR(32),
                            hidden BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                            PRIMARY KEY (user_id, account_id, symbol, currency)
                        )
                        """
                    )
                )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_snaptrade_recurring_investment_preferences_user_id "
                    "ON snaptrade_recurring_investment_preferences(user_id)"
                )
            )


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
