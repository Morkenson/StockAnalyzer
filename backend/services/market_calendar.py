"""US stock market (NYSE) trading-day calendar.

Thin wrapper over the `holidays` NYSE financial calendar so the rest of the app can
ask "is the market open?" / "when's the next session?" without re-deriving holiday rules.
"""
from datetime import date, timedelta

import holidays

# NYSE/Nasdaq share the same full-day market holidays. A wide year range is generated
# lazily by the library, so this is cheap to keep at module scope.
_market_holidays = holidays.financial_holidays("NYSE")


def is_trading_day(day: date) -> bool:
    """True if `day` is a weekday and not a US market holiday."""
    return day.weekday() < 5 and day not in _market_holidays


def next_trading_day(day: date) -> date:
    """The first trading day on or after `day`."""
    current = day
    while not is_trading_day(current):
        current += timedelta(days=1)
    return current
