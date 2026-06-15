from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

# 12:00 PM Central (after the 11:00 AM Central buy window) on trading day 2026-06-15.
AFTER_BUY_TIME = datetime(2026, 6, 15, 17, 0, tzinfo=timezone.utc)

from models.snaptrade_models import TradeExecution
from services import market_calendar
from services import recurring_buy_service as rb


def test_compute_next_run_date_cadences():
    start = date(2026, 6, 15)  # Monday, a trading day
    assert rb.compute_next_run_date("daily", start) == date(2026, 6, 16)
    assert rb.compute_next_run_date("weekly", start) == date(2026, 6, 22)
    assert rb.compute_next_run_date("biweekly", start) == date(2026, 6, 29)
    assert rb.compute_next_run_date("monthly", start) == date(2026, 7, 15)


def test_add_months_clamps_end_of_month():
    # Jan 31 + 1 month -> Feb 28 (no Feb 31)
    assert rb._add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)


def test_compute_next_run_date_rolls_over_weekend():
    # Friday + 1 day lands on Saturday -> rolls forward to Monday.
    assert rb.compute_next_run_date("daily", date(2026, 6, 12)) == date(2026, 6, 15)


def test_compute_next_run_date_skips_market_holiday():
    # 2026-06-18 (Thu) + 1 day = Fri 2026-06-19 = Juneteenth (market closed) -> Monday 06-22.
    assert rb.compute_next_run_date("daily", date(2026, 6, 18)) == date(2026, 6, 22)


def test_market_calendar_trading_days():
    assert market_calendar.is_trading_day(date(2026, 6, 15)) is True   # Monday
    assert market_calendar.is_trading_day(date(2026, 6, 13)) is False  # Saturday
    assert market_calendar.is_trading_day(date(2026, 6, 19)) is False  # Juneteenth
    assert market_calendar.next_trading_day(date(2026, 6, 13)) == date(2026, 6, 15)


def test_compute_next_run_date_rejects_unknown():
    with pytest.raises(ValueError):
        rb.compute_next_run_date("yearly", date(2026, 6, 15))


@pytest.mark.asyncio
async def test_create_validate_and_list():
    with pytest.raises(ValueError):
        await rb.create_schedule("u1", "acc", "AAPL", "weekly", units=0)
    with pytest.raises(ValueError):
        await rb.create_schedule("u1", "acc", "AAPL", "yearly", units=1)
    # Must provide exactly one of units / target_amount.
    with pytest.raises(ValueError):
        await rb.create_schedule("u1", "acc", "AAPL", "weekly")
    with pytest.raises(ValueError):
        await rb.create_schedule("u1", "acc", "AAPL", "weekly", units=1, target_amount=40)

    created = await rb.create_schedule("u1", "acc", "aapl", "weekly", units=2, start_date=date(2026, 6, 15))
    assert created.symbol == "AAPL"
    assert created.units == 2
    assert created.target_amount is None
    assert created.next_run_date == "2026-06-15"  # Monday, already a trading day
    assert created.active is True

    schedules = await rb.list_schedules("u1")
    assert len(schedules) == 1
    assert await rb.list_schedules("other-user") == []


@pytest.mark.asyncio
async def test_create_dollar_target_mode():
    created = await rb.create_schedule("u1", "acc", "AAPL", "daily", target_amount=40)
    assert created.target_amount == 40
    assert created.units is None
    assert created.accumulated_budget == 0.0


@pytest.mark.asyncio
async def test_update_and_delete_scoped_to_user():
    created = await rb.create_schedule("u1", "acc", "AAPL", "weekly", units=1)

    # Another user cannot touch it.
    with pytest.raises(ValueError):
        await rb.update_schedule("intruder", created.id, active=False)
    with pytest.raises(ValueError):
        await rb.delete_schedule("intruder", created.id)

    updated = await rb.update_schedule("u1", created.id, units=5, frequency="monthly", active=False)
    assert updated.units == 5
    assert updated.frequency == "monthly"
    assert updated.active is False

    # Switching to a dollar target clears units.
    switched = await rb.update_schedule("u1", created.id, target_amount=50)
    assert switched.target_amount == 50
    assert switched.units is None

    removed = await rb.delete_schedule("u1", created.id)
    assert removed["removed"] == 1
    assert await rb.list_schedules("u1") == []


@pytest.mark.asyncio
async def test_run_due_schedules_places_orders_and_advances(monkeypatch):
    created = await rb.create_schedule("u1", "acc", "AAPL", "weekly", units=2, start_date=date(2026, 6, 15))

    placed = []

    async def fake_get_secret(user_id):
        return "secret-for-" + user_id

    async def fake_place_order(user_id, user_secret, account_id, action, symbol, **kwargs):
        placed.append((user_id, account_id, action, symbol, kwargs.get("units")))
        return TradeExecution(brokerage_order_id="ord-1", account_id=account_id, status="EXECUTED")

    monkeypatch.setattr(rb.user_svc, "get_user_secret", fake_get_secret)
    monkeypatch.setattr(rb.snaptrade_svc, "place_order", fake_place_order)

    summary = await rb.run_due_schedules(now=AFTER_BUY_TIME)

    assert summary == {"due": 1, "placed": 1, "accumulated": 0, "failed": 0}
    assert placed == [("u1", "acc", "BUY", "AAPL", 2.0)]

    schedules = await rb.list_schedules("u1")
    assert schedules[0].last_run_date == "2026-06-15"
    assert schedules[0].next_run_date == "2026-06-22"  # advanced one week (to Monday)
    assert "executed" in schedules[0].last_status
    assert schedules[0].last_order_id == "ord-1"


@pytest.mark.asyncio
async def test_dollar_mode_buys_whole_shares_and_carries_remainder(monkeypatch):
    # $40/day target, $13 stock -> buy 3 shares ($39), carry $1.
    await rb.create_schedule("u1", "acc", "AAPL", "daily", target_amount=40, start_date=date(2026, 6, 15))

    placed_units = []

    async def fake_get_secret(user_id):
        return "secret"

    async def fake_quote(symbol, client=None):
        return SimpleNamespace(price=13.0)

    async def fake_place_order(user_id, user_secret, account_id, action, symbol, **kwargs):
        placed_units.append(kwargs.get("units"))
        return TradeExecution(brokerage_order_id="ord-x", account_id=account_id, status="EXECUTED", price=13.0)

    monkeypatch.setattr(rb.user_svc, "get_user_secret", fake_get_secret)
    monkeypatch.setattr(rb.stock_svc, "get_stock_quote", fake_quote)
    monkeypatch.setattr(rb.snaptrade_svc, "place_order", fake_place_order)

    summary = await rb.run_due_schedules(now=AFTER_BUY_TIME)

    assert summary == {"due": 1, "placed": 1, "accumulated": 0, "failed": 0}
    assert placed_units == [3.0]
    schedules = await rb.list_schedules("u1")
    assert schedules[0].accumulated_budget == 1.0
    assert "carried" in schedules[0].last_status


@pytest.mark.asyncio
async def test_dollar_mode_accumulates_until_affordable(monkeypatch):
    # $40/day target, $130 stock -> can't afford a share; accumulate, no order placed.
    await rb.create_schedule("u1", "acc", "PRICEY", "daily", target_amount=40, start_date=date(2026, 6, 15))

    async def fake_get_secret(user_id):
        return "secret"

    async def fake_quote(symbol, client=None):
        return SimpleNamespace(price=130.0)

    async def must_not_place(*args, **kwargs):
        raise AssertionError("no order should be placed while accumulating")

    monkeypatch.setattr(rb.user_svc, "get_user_secret", fake_get_secret)
    monkeypatch.setattr(rb.stock_svc, "get_stock_quote", fake_quote)
    monkeypatch.setattr(rb.snaptrade_svc, "place_order", must_not_place)

    summary = await rb.run_due_schedules(now=AFTER_BUY_TIME)

    assert summary == {"due": 1, "placed": 0, "accumulated": 1, "failed": 0}
    schedules = await rb.list_schedules("u1")
    assert schedules[0].accumulated_budget == 40.0
    assert "accumulating" in schedules[0].last_status
    assert schedules[0].next_run_date == "2026-06-16"  # still advances to the next trading day


@pytest.mark.asyncio
async def test_run_due_schedules_records_failure_without_advancing_status(monkeypatch):
    await rb.create_schedule("u1", "acc", "AAPL", "weekly", units=1, start_date=date(2026, 6, 15))

    async def fake_get_secret(user_id):
        return "secret"

    async def boom(*args, **kwargs):
        raise RuntimeError("broker rejected order")

    monkeypatch.setattr(rb.user_svc, "get_user_secret", fake_get_secret)
    monkeypatch.setattr(rb.snaptrade_svc, "place_order", boom)

    summary = await rb.run_due_schedules(now=AFTER_BUY_TIME)

    assert summary == {"due": 1, "placed": 0, "accumulated": 0, "failed": 1}
    schedules = await rb.list_schedules("u1")
    assert "failed" in schedules[0].last_status
    # next_run_date still advances so we don't retry-spam the same failing order every hour
    assert schedules[0].next_run_date == "2026-06-22"


@pytest.mark.asyncio
async def test_run_due_schedules_skips_future_and_inactive(monkeypatch):
    await rb.create_schedule("u1", "acc", "AAPL", "weekly", units=1, start_date=date(2026, 12, 1))
    inactive = await rb.create_schedule("u1", "acc", "MSFT", "weekly", units=1, start_date=date(2026, 1, 1))
    await rb.update_schedule("u1", inactive.id, active=False)

    async def fail_secret(user_id):
        raise AssertionError("should not run any schedule")

    monkeypatch.setattr(rb.user_svc, "get_user_secret", fail_secret)

    summary = await rb.run_due_schedules(now=AFTER_BUY_TIME)
    assert summary == {"due": 0, "placed": 0, "accumulated": 0, "failed": 0}


@pytest.mark.asyncio
async def test_run_due_schedules_waits_until_buy_time(monkeypatch):
    await rb.create_schedule("u1", "acc", "AAPL", "daily", units=1, start_date=date(2026, 6, 15))

    async def fail_secret(user_id):
        raise AssertionError("should not run before 11am Central")

    monkeypatch.setattr(rb.user_svc, "get_user_secret", fail_secret)

    # 2026-06-15 14:00 UTC = 09:00 AM Central, before the 11:00 buy window.
    summary = await rb.run_due_schedules(now=datetime(2026, 6, 15, 14, 0, tzinfo=timezone.utc))
    assert summary["due"] == 0
    assert summary["placed"] == 0
    assert summary.get("skipped") == "before buy time"


@pytest.mark.asyncio
async def test_run_due_schedules_skips_non_trading_day(monkeypatch):
    await rb.create_schedule("u1", "acc", "AAPL", "daily", units=1, start_date=date(2026, 6, 15))

    async def fail_secret(user_id):
        raise AssertionError("should not run on a closed-market day")

    monkeypatch.setattr(rb.user_svc, "get_user_secret", fail_secret)

    # 2026-06-13 is a Saturday — the whole pass is skipped, schedules stay due.
    summary = await rb.run_due_schedules(now=datetime(2026, 6, 13, 17, 0, tzinfo=timezone.utc))
    assert summary["due"] == 0
    assert summary["placed"] == 0
    assert summary.get("skipped") == "market closed"
