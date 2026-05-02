import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from datetime import datetime

from main import app
from models.stock_models import StockQuote, StockSearchResult, StockHistoricalData
from services.stock_data_service import StockDataConfigurationError

client = TestClient(app)

MOCK_QUOTE = StockQuote(symbol="AAPL", price=150.0, change=1.5, change_percent=1.0, volume=5000000)
MOCK_RESULTS = [StockSearchResult(symbol="AAPL", name="Apple Inc.", exchange="NASDAQ", type="Common Stock")]
MOCK_HISTORICAL = [
    StockHistoricalData(date=datetime(2024, 1, 1), open=148.0, high=152.0, low=147.0, close=150.0, volume=1000000)
]


class TestSearchStocks:
    def test_success(self):
        with patch("routers.stock.stock_svc.search_stocks", new=AsyncMock(return_value=MOCK_RESULTS)):
            resp = client.get("/api/stock/search?query=AAPL")
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert resp.json()["data"][0]["symbol"] == "AAPL"

    def test_service_exception_returns_400(self):
        with patch("routers.stock.stock_svc.search_stocks", new=AsyncMock(side_effect=Exception("API down"))):
            resp = client.get("/api/stock/search?query=AAPL")
        assert resp.status_code == 400
        assert resp.json()["success"] is False


class TestGetStockQuote:
    def test_found(self):
        with patch("routers.stock.stock_svc.get_stock_quote", new=AsyncMock(return_value=MOCK_QUOTE)):
            resp = client.get("/api/stock/quote/AAPL")
        assert resp.status_code == 200
        assert resp.json()["data"]["symbol"] == "AAPL"
        assert resp.json()["data"]["price"] == 150.0

    def test_not_found_returns_404(self):
        with patch("routers.stock.stock_svc.get_stock_quote", new=AsyncMock(return_value=None)):
            resp = client.get("/api/stock/quote/INVALID")
        assert resp.status_code == 404
        assert resp.json()["success"] is False

    def test_service_exception_returns_400(self):
        with patch("routers.stock.stock_svc.get_stock_quote", new=AsyncMock(side_effect=Exception("Timeout"))):
            resp = client.get("/api/stock/quote/AAPL")
        assert resp.status_code == 400

    def test_missing_provider_config_returns_503(self):
        with patch(
            "routers.stock.stock_svc.get_stock_quote",
            new=AsyncMock(side_effect=StockDataConfigurationError("TWELVE_DATA_API_KEY is not configured")),
        ):
            resp = client.get("/api/stock/quote/AAPL")
        assert resp.status_code == 503
        assert "TWELVE_DATA_API_KEY" in resp.json()["message"]


class TestGetMultipleQuotes:
    def test_success(self):
        mock_quotes = [MOCK_QUOTE, StockQuote(symbol="MSFT", price=300.0)]
        with patch("routers.stock.stock_svc.get_multiple_stock_quotes", new=AsyncMock(return_value=mock_quotes)):
            resp = client.post("/api/stock/quotes", json=["AAPL", "MSFT"])
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 2

    def test_empty_list_returns_400(self):
        resp = client.post("/api/stock/quotes", json=[])
        assert resp.status_code == 400
        assert resp.json()["success"] is False


class TestGetHistorical:
    def test_found(self):
        with patch("routers.stock.stock_svc.get_historical_data", new=AsyncMock(return_value=MOCK_HISTORICAL)):
            resp = client.get("/api/stock/historical/AAPL")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_empty_returns_404(self):
        with patch("routers.stock.stock_svc.get_historical_data", new=AsyncMock(return_value=[])):
            resp = client.get("/api/stock/historical/INVALID")
        assert resp.status_code == 404
