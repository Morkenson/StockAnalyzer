"""Persistent monthly usage counters for rate-limited external APIs.

Periods are anchored to a billing day-of-month (the provider's signup
anniversary), so the counter resets when the provider's quota does — not on
the calendar month.
"""
import calendar
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db_models import ExternalApiUsage


def _anchored(year: int, month: int, anchor_day: int) -> date:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(anchor_day, last_day))


def current_period_start(today: date, anchor_day: int) -> date:
    candidate = _anchored(today.year, today.month, anchor_day)
    if today >= candidate:
        return candidate
    if today.month == 1:
        return _anchored(today.year - 1, 12, anchor_day)
    return _anchored(today.year, today.month - 1, anchor_day)


def next_period_start(period_start: date, anchor_day: int) -> date:
    if period_start.month == 12:
        return _anchored(period_start.year + 1, 1, anchor_day)
    return _anchored(period_start.year, period_start.month + 1, anchor_day)


def get_count(db: Session, provider: str, period_start: date) -> int:
    row = db.scalar(
        select(ExternalApiUsage).where(
            ExternalApiUsage.provider == provider,
            ExternalApiUsage.period_start == period_start,
        )
    )
    return row.count if row else 0


def try_consume(db: Session, provider: str, period_start: date, limit: int) -> bool:
    """Atomically reserve one request against the cap; False once it is reached.

    Counts are reserved BEFORE the external call is made, because failed
    requests still count against the provider's quota.
    """
    row = db.scalar(
        select(ExternalApiUsage)
        .where(
            ExternalApiUsage.provider == provider,
            ExternalApiUsage.period_start == period_start,
        )
        .with_for_update()
    )
    if row is None:
        row = ExternalApiUsage(provider=provider, period_start=period_start, count=0)
        db.add(row)
        try:
            db.flush()
        except IntegrityError:
            # Another request created the row concurrently — re-read it locked
            db.rollback()
            row = db.scalar(
                select(ExternalApiUsage)
                .where(
                    ExternalApiUsage.provider == provider,
                    ExternalApiUsage.period_start == period_start,
                )
                .with_for_update()
            )
    if row.count >= limit:
        db.commit()
        return False
    row.count += 1
    db.commit()
    return True
