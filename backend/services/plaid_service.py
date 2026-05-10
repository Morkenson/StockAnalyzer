"""Plaid integration and cashflow import helpers."""
import base64
import hashlib
import logging
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

import httpx
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from db_models import CashflowEntry, PlaidAccount, PlaidItem

logger = logging.getLogger(__name__)

ALLOWED_ACCOUNT_TYPES = {
    ("credit", "credit card"),
    ("depository", "checking"),
    ("depository", "savings"),
}

PLAID_BASE_URLS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}


class PlaidConfigurationError(RuntimeError):
    pass


class PlaidServiceError(RuntimeError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _number(value: Any) -> float | None:
    if value is None:
        return None
    return float(value) if isinstance(value, Decimal) else value


def _base_url() -> str:
    return PLAID_BASE_URLS.get(config.PLAID_ENV, PLAID_BASE_URLS["sandbox"])


def _products() -> list[str]:
    return [item.strip() for item in config.PLAID_PRODUCTS.split(",") if item.strip()] or ["transactions"]


def _country_codes() -> list[str]:
    return [item.strip() for item in config.PLAID_COUNTRY_CODES.split(",") if item.strip()] or ["US"]


def _require_config() -> None:
    if not config.PLAID_CLIENT_ID or not config.PLAID_SECRET:
        raise PlaidConfigurationError("Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET.")


def _fernet() -> Fernet:
    seed = config.PLAID_TOKEN_ENCRYPTION_KEY
    if not seed:
        raise PlaidConfigurationError(
            "PLAID_TOKEN_ENCRYPTION_KEY must be set to a dedicated secret (do not reuse JWT_SECRET)."
        )
    key = base64.urlsafe_b64encode(hashlib.sha256(seed.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_access_token(access_token: str) -> str:
    return _fernet().encrypt(access_token.encode("utf-8")).decode("utf-8")


def decrypt_access_token(encrypted: str) -> str:
    try:
        return _fernet().decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise PlaidConfigurationError("Stored Plaid token cannot be decrypted with the current encryption key.") from exc


async def _plaid_post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    _require_config()
    body = {"client_id": config.PLAID_CLIENT_ID, "secret": config.PLAID_SECRET, **payload}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{_base_url()}{path}", json=body)
    data = response.json() if response.content else {}
    if response.status_code >= 400:
        message = data.get("error_message") or data.get("display_message") or "Plaid request failed"
        raise PlaidServiceError(message, status_code=response.status_code)
    return data


async def create_link_token(user_id: str) -> str:
    data = await _plaid_post(
        "/link/token/create",
        {
            "client_name": "Mork Wealth",
            "country_codes": _country_codes(),
            "language": "en",
            "products": _products(),
            "transactions": {"days_requested": 90},
            "user": {"client_user_id": user_id},
            "account_filters": {
                "credit": {"account_subtypes": ["credit card"]},
                "depository": {"account_subtypes": ["checking", "savings"]},
            },
        },
    )
    return data["link_token"]


async def exchange_public_token(
    db: Session,
    user_id: str,
    public_token: str,
    institution_id: str | None = None,
    institution_name: str | None = None,
) -> dict[str, Any]:
    data = await _plaid_post("/item/public_token/exchange", {"public_token": public_token})
    access_token = data["access_token"]
    plaid_item_id = data["item_id"]
    item = db.scalar(select(PlaidItem).where(PlaidItem.user_id == user_id, PlaidItem.plaid_item_id == plaid_item_id))
    if item is None:
        item = PlaidItem(user_id=user_id, plaid_item_id=plaid_item_id, access_token_encrypted=encrypt_access_token(access_token))
        db.add(item)
    else:
        item.access_token_encrypted = encrypt_access_token(access_token)
    item.institution_id = institution_id
    item.institution_name = institution_name
    item.last_sync_error = None
    db.commit()
    db.refresh(item)
    summary = await sync_item(db, item)
    return {"itemId": item.id, "plaidItemId": item.plaid_item_id, "sync": summary}


async def get_accounts_from_plaid(access_token: str) -> list[dict[str, Any]]:
    data = await _plaid_post("/accounts/get", {"access_token": access_token})
    return data.get("accounts", [])


async def remove_item(access_token: str) -> None:
    await _plaid_post(
        "/item/remove",
        {
            "access_token": access_token,
            "reason_code": "OTHER",
            "reason_note": "User disconnected Plaid connection in Mork Wealth.",
        },
    )


def _is_allowed_account(account: dict[str, Any]) -> bool:
    return (account.get("type"), account.get("subtype")) in ALLOWED_ACCOUNT_TYPES


def _save_accounts(db: Session, item: PlaidItem, accounts: list[dict[str, Any]]) -> set[str]:
    allowed_ids: set[str] = set()
    now = _now()
    for account in accounts:
        if not _is_allowed_account(account):
            continue
        plaid_account_id = account["account_id"]
        row = db.scalar(
            select(PlaidAccount).where(
                PlaidAccount.user_id == item.user_id,
                PlaidAccount.plaid_account_id == plaid_account_id,
            )
        )
        if row is None:
            row = PlaidAccount(user_id=item.user_id, item_id=item.id, plaid_account_id=plaid_account_id, name=account.get("name") or "Account", type=account.get("type") or "")
            db.add(row)
        if not row.hidden:
            allowed_ids.add(plaid_account_id)
        balances = account.get("balances") or {}
        row.item_id = item.id
        row.name = account.get("name") or row.name
        row.official_name = account.get("official_name")
        row.mask = account.get("mask")
        row.type = account.get("type") or row.type
        row.subtype = account.get("subtype")
        row.current_balance = balances.get("current")
        row.available_balance = balances.get("available")
        row.iso_currency_code = balances.get("iso_currency_code")
        row.balance_updated_at = now
    db.commit()
    return allowed_ids


def _category(transaction: dict[str, Any]) -> str:
    personal = transaction.get("personal_finance_category") or {}
    raw = personal.get("primary") or personal.get("detailed")
    if not raw:
        categories = transaction.get("category") or []
        raw = categories[0] if categories else "Uncategorized"
    return str(raw).replace("_", " ").title()


def _transaction_type(amount: float) -> str:
    return "expense" if amount >= 0 else "income"


def _account_type(accounts_by_id: dict[str, dict[str, Any]], account_id: str | None) -> tuple[str | None, str | None]:
    account = accounts_by_id.get(account_id or "") or {}
    return account.get("type"), account.get("subtype")


def _is_credit_payment_or_transfer(transaction: dict[str, Any]) -> bool:
    amount = float(transaction.get("amount") or 0)
    name = str(transaction.get("name") or transaction.get("merchant_name") or "").lower()
    category = _category(transaction).lower()
    categories = [str(item).lower() for item in transaction.get("category") or []]
    detailed_category = str((transaction.get("personal_finance_category") or {}).get("detailed") or "").lower()

    if "credit card" in name and "payment" in name:
        return True
    if "loan payments" in category or "loan payments" in categories:
        return True
    if "transfer" in detailed_category and "payment" in detailed_category:
        return True
    if amount < 0 and ("payment" in name or "loan payments" in category):
        return True
    if amount >= 0 and ("autopay payment" in name or name.startswith("automatic payment")):
        return True
    return False


def _should_import_transaction(transaction: dict[str, Any], accounts_by_id: dict[str, dict[str, Any]]) -> bool:
    if transaction.get("pending"):
        return False
    account_type, account_subtype = _account_type(accounts_by_id, transaction.get("account_id"))
    amount = float(transaction.get("amount") or 0)
    if account_type == "depository" and account_subtype in {"checking", "savings"}:
        return amount < 0 and not _is_credit_payment_or_transfer(transaction)
    if account_type == "credit" and account_subtype == "credit card":
        return not _is_credit_payment_or_transfer(transaction)
    return False


def _upsert_transaction(db: Session, user_id: str, transaction: dict[str, Any], allowed_account_ids: set[str], accounts_by_id: dict[str, dict[str, Any]]) -> bool:
    if transaction.get("pending") or transaction.get("account_id") not in allowed_account_ids:
        return False
    transaction_id = transaction["transaction_id"]
    if not _should_import_transaction(transaction, accounts_by_id):
        row = db.scalar(
            select(CashflowEntry).where(
                CashflowEntry.user_id == user_id,
                CashflowEntry.plaid_transaction_id == transaction_id,
            )
        )
        if row and row.removed_at is None:
            row.removed_at = _now()
        return False
    amount = float(transaction.get("amount") or 0)
    row = db.scalar(
        select(CashflowEntry).where(
            CashflowEntry.user_id == user_id,
            CashflowEntry.plaid_transaction_id == transaction_id,
        )
    )
    if row is None:
        row = CashflowEntry(
            user_id=user_id,
            source="plaid",
            plaid_transaction_id=transaction_id,
            plaid_item_id=transaction.get("item_id"),
            plaid_account_id=transaction.get("account_id"),
        )
        db.add(row)
    row.source = "plaid"
    row.type = _transaction_type(amount)
    row.name = transaction.get("name") or transaction.get("merchant_name") or "Plaid transaction"
    row.merchant_name = transaction.get("merchant_name")
    row.category = _category(transaction)
    row.amount = abs(amount)
    row.date = date.fromisoformat(transaction["date"])
    row.plaid_item_id = transaction.get("item_id")
    row.plaid_account_id = transaction.get("account_id")
    row.pending = False
    row.removed_at = None
    return True


async def sync_item(db: Session, item: PlaidItem) -> dict[str, int]:
    item.last_sync_started_at = _now()
    item.last_sync_error = None
    db.commit()

    added = modified = removed = 0
    try:
        access_token = decrypt_access_token(item.access_token_encrypted)
        accounts = await get_accounts_from_plaid(access_token)
        allowed_account_ids = _save_accounts(db, item, accounts)
        accounts_by_id = {account.get("account_id"): account for account in accounts}
        has_more = True
        cursor = item.transaction_cursor
        while has_more:
            payload: dict[str, Any] = {"access_token": access_token, "count": 500}
            if cursor:
                payload["cursor"] = cursor
            data = await _plaid_post("/transactions/sync", payload)
            for transaction in data.get("added", []):
                if _upsert_transaction(db, item.user_id, transaction, allowed_account_ids, accounts_by_id):
                    added += 1
            for transaction in data.get("modified", []):
                if transaction.get("pending"):
                    row = db.scalar(
                        select(CashflowEntry).where(
                            CashflowEntry.user_id == item.user_id,
                            CashflowEntry.plaid_transaction_id == transaction["transaction_id"],
                        )
                    )
                    if row:
                        row.removed_at = _now()
                    continue
                if _upsert_transaction(db, item.user_id, transaction, allowed_account_ids, accounts_by_id):
                    modified += 1
            for transaction in data.get("removed", []):
                row = db.scalar(
                    select(CashflowEntry).where(
                        CashflowEntry.user_id == item.user_id,
                        CashflowEntry.plaid_transaction_id == transaction.get("transaction_id"),
                    )
                )
                if row and row.removed_at is None:
                    row.removed_at = _now()
                    removed += 1
            cursor = data.get("next_cursor") or cursor
            has_more = bool(data.get("has_more"))
        item.transaction_cursor = cursor
        item.last_sync_at = _now()
        item.last_sync_error = None
        db.commit()
    except Exception as exc:
        db.rollback()
        item = db.get(PlaidItem, item.id)
        if item:
            item.last_sync_error = str(exc)
            db.commit()
        raise
    return {"added": added, "modified": modified, "removed": removed}


async def sync_user_items(db: Session, user_id: str, auto: bool = False) -> dict[str, Any]:
    items = db.scalars(select(PlaidItem).where(PlaidItem.user_id == user_id)).all()
    today = _now().date()
    totals = {"added": 0, "modified": 0, "removed": 0, "itemsSynced": 0, "skipped": False}
    for item in items:
        if auto and item.last_sync_at and item.last_sync_at.date() >= today:
            totals["skipped"] = True
            continue
        result = await sync_item(db, item)
        totals["itemsSynced"] += 1
        totals["added"] += result["added"]
        totals["modified"] += result["modified"]
        totals["removed"] += result["removed"]
    return totals


def account_row(account: PlaidAccount) -> dict[str, Any]:
    return {
        "id": account.id,
        "itemId": account.item_id,
        "plaidAccountId": account.plaid_account_id,
        "name": account.name,
        "officialName": account.official_name,
        "mask": account.mask,
        "type": account.type,
        "subtype": account.subtype,
        "currentBalance": _number(account.current_balance),
        "availableBalance": _number(account.available_balance),
        "isoCurrencyCode": account.iso_currency_code,
        "institutionName": account.item.institution_name if account.item else None,
        "balanceUpdatedAt": account.balance_updated_at.isoformat() if account.balance_updated_at else None,
        "lastSyncAt": account.item.last_sync_at.isoformat() if account.item and account.item.last_sync_at else None,
        "lastSyncError": account.item.last_sync_error if account.item else None,
    }
