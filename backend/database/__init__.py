"""Database setup for normal PostgreSQL/SQLite connections."""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./stockanalyzer.db")
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _database_url()
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    _run_migrations()


def _run_migrations() -> None:
    from alembic import command
    from alembic.config import Config

    database_dir = Path(__file__).resolve().parent
    config = Config(str(database_dir / "alembic.ini"))
    config.set_main_option("script_location", str(database_dir / "migrations"))
    command.upgrade(config, "head")


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
