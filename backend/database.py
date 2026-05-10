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


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
