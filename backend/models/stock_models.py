from datetime import datetime

from pydantic import BaseModel, ConfigDict


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0].lower() + "".join(p.capitalize() for p in parts[1:])


class StockSearchResult(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    symbol: str = ""
    name: str = ""
    exchange: str = ""
    type: str = ""


class StockQuote(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    symbol: str = ""
    price: float = 0.0
    change: float = 0.0
    change_percent: float = 0.0
    volume: int = 0
    timestamp: datetime | None = None


class StockDetails(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    symbol: str = ""
    name: str = ""
    exchange: str = ""
    sector: str | None = None
    industry: str | None = None
    market_cap: float | None = None
    current_price: float = 0.0
    previous_close: float | None = None
    change: float | None = None
    change_percent: float | None = None
    volume: int | None = None
    average_volume: int | None = None
    high_52_week: float | None = None
    low_52_week: float | None = None
    pe_ratio: float | None = None
    dividend_yield: float | None = None
    description: str | None = None


class StockHistoricalData(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    date: datetime
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    volume: int = 0
    adjusted_close: float | None = None
