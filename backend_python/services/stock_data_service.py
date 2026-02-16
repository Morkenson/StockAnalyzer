"""Twelve Data API client for stock search, quotes, details, and historical data."""
import logging
from datetime import datetime
from typing import Any
from urllib.parse import quote_plus

import httpx

from config import TWELVE_DATA_API_KEY, TWELVE_DATA_API_URL
from models.stock_models import (
    StockDetails,
    StockHistoricalData,
    StockQuote,
    StockSearchResult,
)

logger = logging.getLogger(__name__)


async def search_stocks(query: str) -> list[StockSearchResult]:
    if not query or not query.strip():
        return []
    url = f"{TWELVE_DATA_API_URL}/symbol_search?symbol={quote_plus(query.strip())}&apikey={TWELVE_DATA_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        resp.raise_for_status()
    data = resp.json()
    results = []
    for item in data.get("data", [])[:5]:
        results.append(
            StockSearchResult(
                symbol=item.get("symbol", ""),
                name=item.get("instrument_name", ""),
                exchange=item.get("exchange", ""),
                type=item.get("instrument_type", ""),
            )
        )
    return results


def _parse_decimal(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _parse_int(val: Any, default: int = 0) -> int:
    if val is None:
        return default
    if isinstance(val, int):
        return val
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return default


async def get_stock_quote(symbol: str) -> StockQuote | None:
    url = f"{TWELVE_DATA_API_URL}/quote?symbol={quote_plus(symbol)}&apikey={TWELVE_DATA_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        resp.raise_for_status()
    result = resp.json()
    if result.get("status") == "error":
        return None
    price = _parse_decimal(result.get("close"), 0)
    prev_close = _parse_decimal(result.get("previous_close"), price)
    change = _parse_decimal(result.get("change"), price - prev_close)
    change_pct = _parse_decimal(
        result.get("percent_change"),
        (change / prev_close * 100) if prev_close else 0,
    )
    volume = _parse_int(result.get("volume"), 0)
    return StockQuote(
        symbol=result.get("symbol", symbol),
        price=price,
        change=change,
        change_percent=change_pct,
        volume=volume,
        timestamp=datetime.utcnow(),
    )


async def get_stock_details(symbol: str) -> StockDetails | None:
    quote = await get_stock_quote(symbol)
    if not quote:
        return None
    details = StockDetails(
        symbol=quote.symbol,
        current_price=quote.price,
        change=quote.change,
        change_percent=quote.change_percent,
        volume=quote.volume,
    )
    profile_url = f"{TWELVE_DATA_API_URL}/profile?symbol={quote_plus(symbol)}&apikey={TWELVE_DATA_API_KEY}"
    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(profile_url)
    if profile_resp.is_success:
        profile = profile_resp.json()
        if profile.get("status") == "error":
            logger.warning(
                "Profile API returned error for symbol %s: %s",
                symbol,
                profile.get("message", "Unknown"),
            )
        else:
            details.name = profile.get("name", "")
            details.exchange = profile.get("exchange", "")
            details.sector = profile.get("sector")
            details.industry = profile.get("industry")
            details.description = profile.get("description")
            details.market_cap = _parse_decimal(profile.get("market_capitalization")) or None
            details.pe_ratio = _parse_decimal(profile.get("pe_ratio")) or None
            details.dividend_yield = _parse_decimal(profile.get("dividend_yield")) or None
            details.high_52_week = _parse_decimal(profile.get("52_week_high") or profile.get("fifty_two_week_high")) or None
            details.low_52_week = _parse_decimal(profile.get("52_week_low") or profile.get("fifty_two_week_low")) or None
            details.average_volume = _parse_int(profile.get("average_volume")) or None
    if details.high_52_week is None or details.low_52_week is None:
        try:
            hist = await get_historical_data(symbol, "1day", 30)
            if hist:
                details.high_52_week = max(h.high for h in hist)
                details.low_52_week = min(h.low for h in hist)
        except Exception as e:
            logger.exception("Failed to get 52-week from historical for %s: %s", symbol, e)
    return details


async def get_multiple_stock_quotes(symbols: list[str]) -> list[StockQuote]:
    import asyncio
    tasks = [get_stock_quote(s) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    quotes = []
    for r in results:
        if isinstance(r, StockQuote):
            quotes.append(r)
        elif isinstance(r, Exception):
            logger.warning("Quote failed: %s", r)
    return quotes


async def get_historical_data(
    symbol: str,
    interval: str = "1day",
    output_size: int | None = None,
) -> list[StockHistoricalData]:
    if output_size is None:
        output_size = {"1day": 30, "1week": 12, "1month": 12}.get(interval, 30)
    url = f"{TWELVE_DATA_API_URL}/time_series?symbol={quote_plus(symbol)}&interval={interval}&outputsize={output_size}&apikey={TWELVE_DATA_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        resp.raise_for_status()
    result = resp.json()
    if result.get("status") == "error":
        logger.warning("Historical API error for %s: %s", symbol, result.get("message"))
        return []
    out = []
    for v in result.get("values", []):
        dt_str = v.get("datetime")
        if not dt_str:
            continue
        try:
            date = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except ValueError:
            continue
        out.append(
            StockHistoricalData(
                date=date,
                open=_parse_decimal(v.get("open")),
                high=_parse_decimal(v.get("high")),
                low=_parse_decimal(v.get("low")),
                close=_parse_decimal(v.get("close")),
                volume=_parse_int(v.get("volume")),
            )
        )
    return sorted(out, key=lambda x: x.date)
