"""In-memory user secret storage. Replace with database for production."""
from typing import Optional

_user_secrets: dict[str, str] = {}


async def get_user_secret(user_id: str) -> Optional[str]:
    return _user_secrets.get(user_id)


async def store_user_secret(user_id: str, user_secret: str) -> None:
    _user_secrets[user_id] = user_secret
