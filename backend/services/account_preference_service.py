"""Portfolio account display preferences."""
import os

from sqlalchemy import select

from database import SessionLocal
from db_models import SnapTradeAccountPreference

_preferences: dict[tuple[str, str], dict[str, object]] = {}
_use_database = bool(os.getenv("DATABASE_URL"))


async def get_preferences(user_id: str) -> dict[str, dict[str, object]]:
    if _use_database:
        with SessionLocal() as db:
            rows = db.scalars(
                select(SnapTradeAccountPreference).where(SnapTradeAccountPreference.user_id == user_id)
            ).all()
            return {
                row.account_id: {
                    "nickname": row.nickname,
                    "hidden": row.hidden,
                }
                for row in rows
            }
    return {
        account_id: dict(preference)
        for (stored_user_id, account_id), preference in _preferences.items()
        if stored_user_id == user_id
    }


async def update_preference(
    user_id: str,
    account_id: str,
    nickname: str | None = None,
    hidden: bool | None = None,
) -> dict[str, object]:
    normalized_nickname = nickname.strip() if isinstance(nickname, str) else nickname
    if normalized_nickname == "":
        normalized_nickname = None

    if _use_database:
        with SessionLocal() as db:
            row = db.get(SnapTradeAccountPreference, {"user_id": user_id, "account_id": account_id})
            if not row:
                row = SnapTradeAccountPreference(user_id=user_id, account_id=account_id)
                db.add(row)
            if nickname is not None:
                row.nickname = normalized_nickname
            if hidden is not None:
                row.hidden = hidden
            db.commit()
            db.refresh(row)
            return {"accountId": row.account_id, "nickname": row.nickname, "hidden": row.hidden}

    key = (user_id, account_id)
    current = _preferences.get(key, {"nickname": None, "hidden": False})
    if nickname is not None:
        current["nickname"] = normalized_nickname
    if hidden is not None:
        current["hidden"] = hidden
    _preferences[key] = current
    return {"accountId": account_id, **current}


async def hide_account(user_id: str, account_id: str) -> dict[str, object]:
    return await update_preference(user_id, account_id, hidden=True)
