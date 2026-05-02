import pytest

from models.stock_models import StockQuote
from services import stock_data_service as svc


@pytest.fixture(autouse=True)
def twelve_data_key(monkeypatch):
    monkeypatch.setattr(svc, "TWELVE_DATA_API_KEY", "test-key")


class FakeResponse:
    def __init__(self, payload, is_success=True):
        self._payload = payload
        self.is_success = is_success

    def json(self):
        return self._payload

    def raise_for_status(self):
        return None


class FakeAsyncClient:
    calls = []
    responses = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url):
        self.__class__.calls.append(url)
        return self.__class__.responses.pop(0)


@pytest.mark.asyncio
async def test_search_stocks_maps_results(monkeypatch):
    FakeAsyncClient.responses = [
        FakeResponse(
            {
                "data": [
                    {
                        "symbol": "AAPL",
                        "instrument_name": "Apple Inc.",
                        "exchange": "NASDAQ",
                        "instrument_type": "Common Stock",
                    }
                ]
            }
        )
    ]
    monkeypatch.setattr(svc.httpx, "AsyncClient", FakeAsyncClient)

    results = await svc.search_stocks(" apple ")

    assert results[0].symbol == "AAPL"
    assert results[0].name == "Apple Inc."


@pytest.mark.asyncio
async def test_search_stocks_requires_api_key(monkeypatch):
    monkeypatch.setattr(svc, "TWELVE_DATA_API_KEY", "")

    with pytest.raises(svc.StockDataConfigurationError):
        await svc.search_stocks("AAPL")


@pytest.mark.asyncio
async def test_get_stock_quote_returns_none_for_api_error():
    class Client:
        async def get(self, url):
            return FakeResponse({"status": "error"})

    assert await svc.get_stock_quote("BAD", Client()) is None


@pytest.mark.asyncio
async def test_get_stock_quote_parses_numeric_fields():
    class Client:
        async def get(self, url):
            return FakeResponse(
                {
                    "symbol": "MSFT",
                    "close": "300.50",
                    "previous_close": "295.00",
                    "change": "5.50",
                    "percent_change": "1.86",
                    "volume": "12345",
                }
            )

    quote = await svc.get_stock_quote("MSFT", Client())

    assert quote == StockQuote(
        symbol="MSFT",
        price=300.5,
        change=5.5,
        change_percent=1.86,
        volume=12345,
        timestamp=quote.timestamp,
    )


@pytest.mark.asyncio
async def test_get_historical_data_filters_and_sorts(monkeypatch):
    FakeAsyncClient.responses = [
        FakeResponse(
            {
                "values": [
                    {"datetime": "bad", "open": "1"},
                    {"datetime": "2024-01-02", "open": "2", "high": "4", "low": "1", "close": "3", "volume": "20"},
                    {"datetime": "2024-01-01", "open": "1", "high": "3", "low": "1", "close": "2", "volume": "10"},
                ]
            }
        )
    ]
    monkeypatch.setattr(svc.httpx, "AsyncClient", FakeAsyncClient)

    rows = await svc.get_historical_data("AAPL")

    assert [row.date.day for row in rows] == [1, 2]
    assert rows[1].volume == 20


@pytest.mark.asyncio
async def test_get_multiple_stock_quotes_skips_failures(monkeypatch):
    async def fake_quote(symbol, client):
        if symbol == "BAD":
            raise RuntimeError("boom")
        return StockQuote(symbol=symbol, price=1, change=0, change_percent=0)

    monkeypatch.setattr(svc, "get_stock_quote", fake_quote)

    quotes = await svc.get_multiple_stock_quotes(["aapl", "AAPL", "bad"])

    assert [quote.symbol for quote in quotes] == ["AAPL"]


@pytest.mark.asyncio
async def test_get_stock_details_uses_profile_and_historical(monkeypatch):
    async def fake_quote(symbol):
        return StockQuote(symbol=symbol, price=10, change=1, change_percent=10, volume=100)

    async def fake_history(symbol, interval, output_size):
        return [
            svc.StockHistoricalData(date=svc.datetime(2024, 1, 1), open=1, high=12, low=8, close=10, volume=1)
        ]

    FakeAsyncClient.responses = [
        FakeResponse(
            {
                "name": "Apple Inc.",
                "exchange": "NASDAQ",
                "sector": "Technology",
                "market_capitalization": "1000",
            }
        )
    ]
    monkeypatch.setattr(svc, "get_stock_quote", fake_quote)
    monkeypatch.setattr(svc, "get_historical_data", fake_history)
    monkeypatch.setattr(svc.httpx, "AsyncClient", FakeAsyncClient)

    details = await svc.get_stock_details("AAPL")

    assert details.name == "Apple Inc."
    assert details.high_52_week == 12
    assert details.low_52_week == 8
