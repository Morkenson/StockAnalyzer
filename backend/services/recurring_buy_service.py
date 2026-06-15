"""App-managed recurring buy schedules.

Webull (and some other brokerages) don't offer native recurring buys, so we
store schedules here and place the orders ourselves via the SnapTrade trading
API on a daily-resolution cadence.
"""
import calendar
import logging
import math
import os
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete as sql_delete, select

from database import SessionLocal
from db_models import SnapTradeRecurringBuySchedule
from models.snaptrade_models import RecurringBuySchedule
from services import market_calendar
from services import snaptrade_service as snaptrade_svc
from services import stock_data_service as stock_svc
from services import user_service as user_svc

logger = logging.getLogger(__name__)

FREQUENCIES = {"daily", "weekly", "biweekly", "monthly"}
_INTERVAL_DAYS = {"daily": 1, "weekly": 7, "biweekly": 14}

# Orders are placed at this wall-clock time in this timezone on each due trading day.
BUY_TIMEZONE = ZoneInfo("America/Chicago")
BUY_TIME = time(11, 0)  # 11:00 AM Central


def _central_now(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)).astimezone(BUY_TIMEZONE)

_use_database = bool(os.getenv("DATABASE_URL"))
# In-memory fallback store keyed by schedule id (used when no database is configured).
_schedules: dict[str, dict[str, object]] = {}


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _add_months(start: date, months: int) -> date:
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def compute_next_run_date(frequency: str, from_date: date) -> date:
    if frequency == "monthly":
        raw = _add_months(from_date, 1)
    else:
        interval = _INTERVAL_DAYS.get(frequency)
        if interval is None:
            raise ValueError(f"Unsupported frequency '{frequency}'")
        raw = from_date + timedelta(days=interval)
    # Roll forward onto a real trading day so buys never land on weekends/holidays.
    return market_calendar.next_trading_day(raw)


def _validate(symbol: str, units: float | None, target_amount: float | None, frequency: str) -> tuple[str, str]:
    normalized_symbol = _normalize_symbol(symbol)
    if not normalized_symbol:
        raise ValueError("symbol is required")
    has_units = units is not None
    has_target = target_amount is not None
    if has_units == has_target:
        raise ValueError("provide exactly one of units or targetAmount")
    if has_units and units <= 0:
        raise ValueError("units must be greater than 0")
    if has_target and target_amount <= 0:
        raise ValueError("targetAmount must be greater than 0")
    normalized_frequency = (frequency or "").strip().lower()
    if normalized_frequency not in FREQUENCIES:
        raise ValueError("frequency must be daily, weekly, biweekly, or monthly")
    return normalized_symbol, normalized_frequency


def _field(row, key):
    return row[key] if isinstance(row, dict) else getattr(row, key)


def _opt_float(value):
    return float(value) if value is not None else None


def _to_model(row) -> RecurringBuySchedule:
    def _iso(value):
        return value.isoformat() if isinstance(value, date) else None

    return RecurringBuySchedule(
        id=str(_field(row, "id")),
        account_id=str(_field(row, "account_id")),
        symbol=str(_field(row, "symbol")),
        units=_opt_float(_field(row, "units")),
        target_amount=_opt_float(_field(row, "target_amount")),
        accumulated_budget=float(_field(row, "accumulated_budget") or 0),
        frequency=str(_field(row, "frequency")),
        next_run_date=_iso(_field(row, "next_run_date")),
        last_run_date=_iso(_field(row, "last_run_date")),
        last_status=_field(row, "last_status"),
        last_order_id=_field(row, "last_order_id"),
        active=bool(_field(row, "active")),
    )


async def list_schedules(user_id: str) -> list[RecurringBuySchedule]:
    if _use_database:
        with SessionLocal() as db:
            rows = db.scalars(
                select(SnapTradeRecurringBuySchedule)
                .where(SnapTradeRecurringBuySchedule.user_id == user_id)
                .order_by(SnapTradeRecurringBuySchedule.created_at)
            ).all()
            return [_to_model(row) for row in rows]
    return [
        _to_model(item)
        for item in _schedules.values()
        if item["user_id"] == user_id
    ]


async def create_schedule(
    user_id: str,
    account_id: str,
    symbol: str,
    frequency: str,
    units: float | None = None,
    target_amount: float | None = None,
    start_date: date | None = None,
) -> RecurringBuySchedule:
    normalized_symbol, normalized_frequency = _validate(symbol, units, target_amount, frequency)
    next_run = market_calendar.next_trading_day(start_date or _central_now().date())

    if _use_database:
        with SessionLocal() as db:
            row = SnapTradeRecurringBuySchedule(
                user_id=user_id,
                account_id=account_id,
                symbol=normalized_symbol,
                units=units,
                target_amount=target_amount,
                accumulated_budget=0,
                frequency=normalized_frequency,
                next_run_date=next_run,
                active=True,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return _to_model(row)

    from uuid import uuid4

    schedule_id = str(uuid4())
    _schedules[schedule_id] = {
        "id": schedule_id,
        "user_id": user_id,
        "account_id": account_id,
        "symbol": normalized_symbol,
        "units": units,
        "target_amount": target_amount,
        "accumulated_budget": 0.0,
        "frequency": normalized_frequency,
        "next_run_date": next_run,
        "last_run_date": None,
        "last_status": None,
        "last_order_id": None,
        "active": True,
    }
    return _to_model(_schedules[schedule_id])


async def update_schedule(
    user_id: str,
    schedule_id: str,
    units: float | None = None,
    target_amount: float | None = None,
    frequency: str | None = None,
    next_run_date: date | None = None,
    active: bool | None = None,
) -> RecurringBuySchedule:
    normalized_frequency = None
    if frequency is not None:
        normalized_frequency = frequency.strip().lower()
        if normalized_frequency not in FREQUENCIES:
            raise ValueError("frequency must be daily, weekly, biweekly, or monthly")
    if units is not None and units <= 0:
        raise ValueError("units must be greater than 0")
    if target_amount is not None and target_amount <= 0:
        raise ValueError("targetAmount must be greater than 0")

    if _use_database:
        with SessionLocal() as db:
            row = db.get(SnapTradeRecurringBuySchedule, schedule_id)
            if not row or row.user_id != user_id:
                raise ValueError("Recurring buy not found")
            if units is not None:
                row.units = units
                row.target_amount = None
            if target_amount is not None:
                row.target_amount = target_amount
                row.units = None
            if normalized_frequency is not None:
                row.frequency = normalized_frequency
            if next_run_date is not None:
                row.next_run_date = next_run_date
            if active is not None:
                row.active = active
            db.commit()
            db.refresh(row)
            return _to_model(row)

    item = _schedules.get(schedule_id)
    if not item or item["user_id"] != user_id:
        raise ValueError("Recurring buy not found")
    if units is not None:
        item["units"] = units
        item["target_amount"] = None
    if target_amount is not None:
        item["target_amount"] = target_amount
        item["units"] = None
    if normalized_frequency is not None:
        item["frequency"] = normalized_frequency
    if next_run_date is not None:
        item["next_run_date"] = next_run_date
    if active is not None:
        item["active"] = active
    return _to_model(item)


async def delete_schedule(user_id: str, schedule_id: str) -> dict[str, object]:
    if _use_database:
        with SessionLocal() as db:
            result = db.execute(
                sql_delete(SnapTradeRecurringBuySchedule).where(
                    SnapTradeRecurringBuySchedule.id == schedule_id,
                    SnapTradeRecurringBuySchedule.user_id == user_id,
                )
            )
            db.commit()
            if not result.rowcount:
                raise ValueError("Recurring buy not found")
            return {"id": schedule_id, "removed": result.rowcount}

    item = _schedules.get(schedule_id)
    if not item or item["user_id"] != user_id:
        raise ValueError("Recurring buy not found")
    _schedules.pop(schedule_id, None)
    return {"id": schedule_id, "removed": 1}


def _persist_run(
    schedule_id: str,
    user_id: str,
    status: str,
    order_id: str | None,
    run_date: date,
    accumulated_budget: float | None = None,
) -> None:
    if _use_database:
        with SessionLocal() as db:
            row = db.get(SnapTradeRecurringBuySchedule, schedule_id)
            if not row:
                return
            row.last_run_date = run_date
            row.last_status = status[:255]
            row.last_order_id = order_id
            if accumulated_budget is not None:
                row.accumulated_budget = round(accumulated_budget, 2)
            row.next_run_date = compute_next_run_date(row.frequency, run_date)
            db.commit()
        return
    item = _schedules.get(schedule_id)
    if not item:
        return
    item["last_run_date"] = run_date
    item["last_status"] = status[:255]
    item["last_order_id"] = order_id
    if accumulated_budget is not None:
        item["accumulated_budget"] = round(accumulated_budget, 2)
    item["next_run_date"] = compute_next_run_date(str(item["frequency"]), run_date)


def _due_schedules(today: date) -> list[dict[str, object]]:
    """Return active schedules due on or before today as plain dicts."""
    if _use_database:
        with SessionLocal() as db:
            rows = db.scalars(
                select(SnapTradeRecurringBuySchedule).where(
                    SnapTradeRecurringBuySchedule.active.is_(True),
                    SnapTradeRecurringBuySchedule.next_run_date <= today,
                )
            ).all()
            return [_due_dict(row) for row in rows]
    return [
        _due_dict(item)
        for item in _schedules.values()
        if item["active"] and item["next_run_date"] <= today
    ]


def _due_dict(row) -> dict[str, object]:
    return {
        "id": _field(row, "id"),
        "user_id": _field(row, "user_id"),
        "account_id": _field(row, "account_id"),
        "symbol": _field(row, "symbol"),
        "units": _opt_float(_field(row, "units")),
        "target_amount": _opt_float(_field(row, "target_amount")),
        "accumulated_budget": float(_field(row, "accumulated_budget") or 0),
    }


async def _execute_one(schedule: dict, user_id: str, user_secret: str, run_date: date) -> str:
    """Execute a single due schedule. Returns 'placed', 'accumulated', or 'failed'."""
    schedule_id = str(schedule["id"])
    account_id = str(schedule["account_id"])
    symbol = str(schedule["symbol"])
    target_amount = schedule.get("target_amount")

    # Fixed-share mode: just buy the configured number of shares.
    if target_amount is None:
        execution = await snaptrade_svc.place_order(
            user_id, user_secret, account_id, "BUY", symbol,
            order_type="MARKET", time_in_force="DAY", units=float(schedule["units"]),
        )
        _persist_run(schedule_id, user_id, f"executed: {execution.status or 'submitted'}",
                     execution.brokerage_order_id or None, run_date)
        return "placed"

    # Dollar-cost mode: top up the budget, buy as many whole shares as it covers, carry the rest.
    budget = float(schedule.get("accumulated_budget") or 0) + float(target_amount)
    quote = await stock_svc.get_stock_quote(symbol)
    price = float(getattr(quote, "price", 0) or 0) if quote else 0.0
    if price <= 0:
        _persist_run(schedule_id, user_id, "failed: no live price for symbol", None, run_date,
                     accumulated_budget=budget)
        return "failed"

    shares = math.floor(budget / price)
    if shares < 1:
        _persist_run(schedule_id, user_id,
                     f"accumulating ${budget:.2f} toward ${price:.2f}/share", None, run_date,
                     accumulated_budget=budget)
        return "accumulated"

    execution = await snaptrade_svc.place_order(
        user_id, user_secret, account_id, "BUY", symbol,
        order_type="MARKET", time_in_force="DAY", units=float(shares),
    )
    fill_price = float(execution.price) if execution.price else price
    remaining = budget - (shares * fill_price)
    _persist_run(schedule_id, user_id,
                 f"executed: {shares} share(s) (~${shares * fill_price:.2f}), ${remaining:.2f} carried",
                 execution.brokerage_order_id or None, run_date,
                 accumulated_budget=max(0.0, remaining))
    return "placed"


async def run_due_schedules(now: datetime | None = None) -> dict[str, int]:
    """Run every schedule due as of `now`. Orders fire at BUY_TIME Central on trading days."""
    central = _central_now(now)
    run_date = central.date()
    # Markets are closed on weekends/holidays; don't attempt orders that would just be rejected.
    # Schedules stay due and fire on the next trading-day pass.
    if not market_calendar.is_trading_day(run_date):
        return {"due": 0, "placed": 0, "accumulated": 0, "failed": 0, "skipped": "market closed"}
    # Hold every buy until 11:00 AM Central so orders land mid-session, not pre-market/overnight.
    if central.time() < BUY_TIME:
        return {"due": 0, "placed": 0, "accumulated": 0, "failed": 0, "skipped": "before buy time"}
    due = _due_schedules(run_date)
    placed = 0
    accumulated = 0
    failed = 0
    secret_cache: dict[str, str | None] = {}

    for schedule in due:
        user_id = str(schedule["user_id"])
        if user_id not in secret_cache:
            secret_cache[user_id] = await user_svc.get_user_secret(user_id)
        user_secret = secret_cache[user_id]
        if not user_secret:
            _persist_run(str(schedule["id"]), user_id, "failed: no SnapTrade connection", None, run_date)
            failed += 1
            continue
        try:
            outcome = await _execute_one(schedule, user_id, user_secret, run_date)
            if outcome == "placed":
                placed += 1
            elif outcome == "accumulated":
                accumulated += 1
            else:
                failed += 1
        except Exception as exc:  # noqa: BLE001 - record failure and continue with other schedules
            logger.warning("Recurring buy %s failed for user %s: %s", schedule["id"], user_id, exc)
            _persist_run(str(schedule["id"]), user_id, f"failed: {exc}", None, run_date)
            failed += 1

    if due:
        logger.info(
            "Recurring buy pass: %s placed, %s accumulated, %s failed of %s due",
            placed, accumulated, failed, len(due),
        )
    return {"due": len(due), "placed": placed, "accumulated": accumulated, "failed": failed}
