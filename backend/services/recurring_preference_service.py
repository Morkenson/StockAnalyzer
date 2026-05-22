"""Manual recurring investment preferences."""
import os

from sqlalchemy import delete as sql_delete, select

from database import SessionLocal
from db_models import SnapTradeRecurringInvestmentPreference
from models.snaptrade_models import RecurringInvestment

RECURRING_FREQUENCIES = {"daily", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual", "yearly"}

_preferences: dict[tuple[str, str, str, str], dict[str, object]] = {}
_use_database = bool(os.getenv("DATABASE_URL"))


def _normalize_account_id(account_id: str) -> str:
    return account_id.strip()


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _normalize_currency(currency: str | None) -> str:
    return (currency or "USD").strip().upper() or "USD"


def _normalize_frequency(frequency: str | None) -> str | None:
    if frequency is None:
        return None
    normalized = frequency.strip().lower()
    if normalized not in RECURRING_FREQUENCIES:
        raise ValueError("frequency must be daily, weekly, biweekly, monthly, quarterly, semiannual, or annual")
    return normalized


async def get_preferences(user_id: str) -> dict[tuple[str, str, str], dict[str, object]]:
    if _use_database:
        with SessionLocal() as db:
            rows = db.scalars(
                select(SnapTradeRecurringInvestmentPreference).where(
                    SnapTradeRecurringInvestmentPreference.user_id == user_id
                )
            ).all()
            return {
                (row.account_id, row.symbol, row.currency): {
                    "amount": float(row.amount) if row.amount is not None else None,
                    "frequency": row.frequency,
                    "hidden": row.hidden,
                }
                for row in rows
            }
    return {
        (account_id, symbol, currency): dict(preference)
        for (stored_user_id, account_id, symbol, currency), preference in _preferences.items()
        if stored_user_id == user_id
    }


async def update_preference(
    user_id: str,
    account_id: str,
    symbol: str,
    currency: str | None = "USD",
    amount: float | None = None,
    frequency: str | None = None,
    hidden: bool | None = None,
) -> dict[str, object]:
    normalized_account_id = _normalize_account_id(account_id)
    normalized_symbol = _normalize_symbol(symbol)
    normalized_currency = _normalize_currency(currency)
    normalized_frequency = _normalize_frequency(frequency)

    if not normalized_account_id:
        raise ValueError("accountId is required")
    if not normalized_symbol:
        raise ValueError("symbol is required")
    if amount is not None and amount < 0:
        raise ValueError("amount must be greater than or equal to 0")

    if _use_database:
        with SessionLocal() as db:
            row = db.get(
                SnapTradeRecurringInvestmentPreference,
                {
                    "user_id": user_id,
                    "account_id": normalized_account_id,
                    "symbol": normalized_symbol,
                    "currency": normalized_currency,
                },
            )
            if not row:
                row = SnapTradeRecurringInvestmentPreference(
                    user_id=user_id,
                    account_id=normalized_account_id,
                    symbol=normalized_symbol,
                    currency=normalized_currency,
                )
                db.add(row)
            if amount is not None:
                row.amount = amount
            if frequency is not None:
                row.frequency = normalized_frequency
            if hidden is not None:
                row.hidden = hidden
            db.commit()
            db.refresh(row)
            return _preference_response(row.account_id, row.symbol, row.currency, row.amount, row.frequency, row.hidden)

    key = (user_id, normalized_account_id, normalized_symbol, normalized_currency)
    current = _preferences.get(key, {"amount": None, "frequency": None, "hidden": False})
    if amount is not None:
        current["amount"] = amount
    if frequency is not None:
        current["frequency"] = normalized_frequency
    if hidden is not None:
        current["hidden"] = hidden
    _preferences[key] = current
    return {
        "accountId": normalized_account_id,
        "symbol": normalized_symbol,
        "currency": normalized_currency,
        **current,
    }


async def clear_account_preferences(user_id: str, account_id: str) -> dict[str, object]:
    normalized_account_id = _normalize_account_id(account_id)
    if not normalized_account_id:
        raise ValueError("accountId is required")

    if _use_database:
        with SessionLocal() as db:
            result = db.execute(
                sql_delete(SnapTradeRecurringInvestmentPreference).where(
                    SnapTradeRecurringInvestmentPreference.user_id == user_id,
                    SnapTradeRecurringInvestmentPreference.account_id == normalized_account_id,
                )
            )
            db.commit()
            return {"accountId": normalized_account_id, "removed": result.rowcount or 0}

    keys = [
        key
        for key in _preferences
        if key[0] == user_id and key[1] == normalized_account_id
    ]
    for key in keys:
        _preferences.pop(key, None)
    return {"accountId": normalized_account_id, "removed": len(keys)}


def apply_preferences(
    recurring: list[RecurringInvestment],
    preferences: dict[tuple[str, str, str], dict[str, object]],
) -> list[RecurringInvestment]:
    adjusted: list[RecurringInvestment] = []
    for investment in recurring:
        key = (investment.account_id, _normalize_symbol(investment.symbol), _normalize_currency(investment.currency))
        preference = preferences.get(key)
        if preference and preference.get("hidden"):
            continue
        item = investment.model_copy(deep=True)
        if preference:
            amount = preference.get("amount")
            frequency = preference.get("frequency")
            if isinstance(amount, (int, float)):
                item.amount = float(amount)
            if isinstance(frequency, str) and frequency:
                item.frequency = frequency
            item.source = "manual"
        adjusted.append(item)
    return adjusted


def _preference_response(
    account_id: str,
    symbol: str,
    currency: str,
    amount: object,
    frequency: str | None,
    hidden: bool,
) -> dict[str, object]:
    return {
        "accountId": account_id,
        "symbol": symbol,
        "currency": currency,
        "amount": float(amount) if amount is not None else None,
        "frequency": frequency,
        "hidden": hidden,
    }
