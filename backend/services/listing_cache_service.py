"""Persistent cache for paid external listing responses.

Lets repeat searches reuse a prior RentCast API call instead of spending
quota, keyed by the query parameters that actually vary the upstream request.
"""
import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db_models import RentcastListingCache


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def get(db: Session, provider: str, cache_key: str) -> tuple[list[dict], datetime] | None:
    """Return (listings, fetched_at) for any cached entry, regardless of age."""
    row = db.scalar(
        select(RentcastListingCache).where(
            RentcastListingCache.provider == provider,
            RentcastListingCache.cache_key == cache_key,
        )
    )
    if row is None:
        return None
    return json.loads(row.payload), _as_utc(row.fetched_at)


def get_fresh(
    db: Session, provider: str, cache_key: str, ttl_days: int, now: datetime
) -> tuple[list[dict], datetime] | None:
    """Return (listings, fetched_at) only if the entry is within ttl_days."""
    cached = get(db, provider, cache_key)
    if cached is None:
        return None
    listings, fetched_at = cached
    if now - fetched_at > timedelta(days=ttl_days):
        return None
    return listings, fetched_at


def store(db: Session, provider: str, cache_key: str, listings: list[dict], now: datetime) -> None:
    payload = json.dumps(listings)
    row = db.scalar(
        select(RentcastListingCache).where(
            RentcastListingCache.provider == provider,
            RentcastListingCache.cache_key == cache_key,
        )
    )
    if row is not None:
        row.payload = payload
        row.fetched_at = now
        db.commit()
        return
    db.add(RentcastListingCache(provider=provider, cache_key=cache_key, payload=payload, fetched_at=now))
    try:
        db.commit()
    except IntegrityError:
        # Concurrent insert — update the existing row instead
        db.rollback()
        row = db.scalar(
            select(RentcastListingCache).where(
                RentcastListingCache.provider == provider,
                RentcastListingCache.cache_key == cache_key,
            )
        )
        if row is not None:
            row.payload = payload
            row.fetched_at = now
            db.commit()
