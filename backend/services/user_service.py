"""SnapTrade user secret storage (encrypted at rest)."""
import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select

import config
from database import SessionLocal
from db_models import SnapTradeUserSecret

_user_secrets: dict[str, str] = {}
_use_database = bool(os.getenv("DATABASE_URL"))


def _fernet() -> Fernet:
    seed = config.SNAPTRADE_SECRET_ENCRYPTION_KEY
    if not seed:
        raise RuntimeError(
            "SNAPTRADE_SECRET_ENCRYPTION_KEY must be set to a dedicated secret (do not reuse JWT_SECRET)."
        )
    key = base64.urlsafe_b64encode(hashlib.sha256(seed.encode("utf-8")).digest())
    return Fernet(key)


def _encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def _decrypt(stored: str) -> Optional[str]:
    try:
        return _fernet().decrypt(stored.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None


async def get_user_secret(user_id: str) -> Optional[str]:
    if _use_database:
        with SessionLocal() as db:
            row = db.scalar(select(SnapTradeUserSecret).where(SnapTradeUserSecret.user_id == user_id))
            if not row:
                return None
            decrypted = _decrypt(row.user_secret)
            if decrypted is not None:
                return decrypted
            # Backward compatibility: legacy plaintext row — re-encrypt and return.
            legacy_plaintext = row.user_secret
            row.user_secret = _encrypt(legacy_plaintext)
            db.commit()
            return legacy_plaintext
    return _user_secrets.get(user_id)


async def list_user_secrets() -> dict[str, str]:
    if _use_database:
        with SessionLocal() as db:
            rows = db.scalars(select(SnapTradeUserSecret)).all()
            secrets: dict[str, str] = {}
            for row in rows:
                decrypted = _decrypt(row.user_secret)
                if decrypted is not None:
                    secrets[row.user_id] = decrypted
                    continue
                legacy_plaintext = row.user_secret
                row.user_secret = _encrypt(legacy_plaintext)
                secrets[row.user_id] = legacy_plaintext
            db.commit()
            return secrets
    return dict(_user_secrets)


async def store_user_secret(user_id: str, user_secret: str) -> None:
    encrypted = _encrypt(user_secret)
    if _use_database:
        with SessionLocal() as db:
            row = db.get(SnapTradeUserSecret, user_id)
            if row:
                row.user_secret = encrypted
            else:
                db.add(SnapTradeUserSecret(user_id=user_id, user_secret=encrypted))
            db.commit()
            return
    _user_secrets[user_id] = user_secret


async def delete_user_secret(user_id: str) -> None:
    """Forget a stored SnapTrade user secret.

    Needed when the secret becomes invalid — e.g. after switching SnapTrade client
    credentials, where secrets registered under the old client return code 1083.
    Clearing it lets the next connect re-register a fresh user under the new client.
    """
    if _use_database:
        with SessionLocal() as db:
            row = db.get(SnapTradeUserSecret, user_id)
            if row:
                db.delete(row)
                db.commit()
            return
    _user_secrets.pop(user_id, None)
