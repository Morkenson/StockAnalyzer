"""SnapTrade user secret storage."""
import os
from typing import Optional

from sqlalchemy import select

from database import SessionLocal
from db_models import SnapTradeUserSecret

_user_secrets: dict[str, str] = {}
_use_database = bool(os.getenv("DATABASE_URL"))


async def get_user_secret(user_id: str) -> Optional[str]:
    if _use_database:
        with SessionLocal() as db:
            row = db.scalar(select(SnapTradeUserSecret).where(SnapTradeUserSecret.user_id == user_id))
            return row.user_secret if row else None
    return _user_secrets.get(user_id)


async def store_user_secret(user_id: str, user_secret: str) -> None:
    if _use_database:
        with SessionLocal() as db:
            row = db.get(SnapTradeUserSecret, user_id)
            if row:
                row.user_secret = user_secret
            else:
                db.add(SnapTradeUserSecret(user_id=user_id, user_secret=user_secret))
            db.commit()
            return
    _user_secrets[user_id] = user_secret
