"""Manual dividend payout frequency preferences."""
import os

from sqlalchemy import select

from database import SessionLocal
from db_models import SnapTradeDividendPreference

PAYMENT_FREQUENCIES: dict[str, float] = {
    "weekly": 52,
    "biweekly": 26,
    "monthly": 12,
    "quarterly": 4,
    "semiannual": 2,
    "annual": 1,
}

_preferences: dict[tuple[str, str, str], dict[str, object]] = {}
_use_database = bool(os.getenv("DATABASE_URL"))


def normalize_frequency(value: str) -> tuple[str, float]:
    normalized = (value or "").strip().lower()
    if normalized not in PAYMENT_FREQUENCIES:
        raise ValueError("paymentFrequency must be weekly, biweekly, monthly, quarterly, semiannual, or annual")
    return normalized, PAYMENT_FREQUENCIES[normalized]


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _normalize_currency(currency: str | None) -> str:
    return (currency or "USD").strip().upper() or "USD"


async def get_preferences(user_id: str) -> dict[tuple[str, str], dict[str, object]]:
    if _use_database:
        with SessionLocal() as db:
            rows = db.scalars(
                select(SnapTradeDividendPreference).where(SnapTradeDividendPreference.user_id == user_id)
            ).all()
            return {
                (row.symbol, row.currency): {
                    "payment_frequency": row.payment_frequency,
                    "payments_per_year": float(row.payments_per_year),
                }
                for row in rows
            }
    return {
        (symbol, currency): dict(preference)
        for (stored_user_id, symbol, currency), preference in _preferences.items()
        if stored_user_id == user_id
    }


async def update_preference(
    user_id: str,
    symbol: str,
    payment_frequency: str,
    currency: str | None = "USD",
) -> dict[str, object]:
    normalized_symbol = _normalize_symbol(symbol)
    normalized_currency = _normalize_currency(currency)
    normalized_frequency, payments_per_year = normalize_frequency(payment_frequency)

    if _use_database:
        with SessionLocal() as db:
            row = db.get(
                SnapTradeDividendPreference,
                {
                    "user_id": user_id,
                    "symbol": normalized_symbol,
                    "currency": normalized_currency,
                },
            )
            if not row:
                row = SnapTradeDividendPreference(
                    user_id=user_id,
                    symbol=normalized_symbol,
                    currency=normalized_currency,
                )
                db.add(row)
            row.payment_frequency = normalized_frequency
            row.payments_per_year = payments_per_year
            db.commit()
            db.refresh(row)
            return {
                "symbol": row.symbol,
                "currency": row.currency,
                "paymentFrequency": row.payment_frequency,
                "paymentsPerYear": float(row.payments_per_year),
            }

    key = (user_id, normalized_symbol, normalized_currency)
    preference = {
        "payment_frequency": normalized_frequency,
        "payments_per_year": payments_per_year,
    }
    _preferences[key] = preference
    return {
        "symbol": normalized_symbol,
        "currency": normalized_currency,
        "paymentFrequency": normalized_frequency,
        "paymentsPerYear": payments_per_year,
    }
