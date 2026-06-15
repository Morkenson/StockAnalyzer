"""Extra coverage for routers/stock.py — error branches and the details endpoint."""
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app
from models.stock_models import StockDetails
from services.stock_data_service import StockDataConfigurationError

client = TestClient(app)

MOCK_DETAILS = StockDetails(
    symbol="AAPL",
    name="Apple Inc.",
    exchange="NASDAQ",
    sector="Technology",
    current_price=150.0,
    pe_ratio=28.5,
)

CONFIG_ERROR = StockDataConfigurationError("TWELVE_DATA_API_KEY is not configured")


class TestSearchStocksExtra:
    def test_empty_query_returns_400(self):
        resp = client.get("/api/stock/search?query=")
        assert resp.status_code == 400
        assert resp.json()["success"] is False
        assert "Query parameter is required" in resp.json()["message"]

    def test_missing_provider_config_returns_503(self):
        with patch("routers.stock.stock_svc.search_stocks", new=AsyncMock(side_effect=CONFIG_ERROR)):
            resp = client.get("/api/stock/search?query=AAPL")
        assert resp.status_code == 503
        assert resp.json()["success"] is False
        assert "TWELVE_DATA_API_KEY" in resp.json()["message"]


class TestGetStockDetails:
    def test_found(self):
        with patch("routers.stock.stock_svc.get_stock_details", new=AsyncMock(return_value=MOCK_DETAILS)):
            resp = client.get("/api/stock/details/AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["symbol"] == "AAPL"
        assert body["data"]["currentPrice"] == 150.0
        assert body["data"]["peRatio"] == 28.5

    def test_not_found_returns_404(self):
        with patch("routers.stock.stock_svc.get_stock_details", new=AsyncMock(return_value=None)):
            resp = client.get("/api/stock/details/INVALID")
        assert resp.status_code == 404
        assert resp.json()["success"] is False
        assert "INVALID" in resp.json()["message"]

    def test_missing_provider_config_returns_503(self):
        with patch("routers.stock.stock_svc.get_stock_details", new=AsyncMock(side_effect=CONFIG_ERROR)):
            resp = client.get("/api/stock/details/AAPL")
        assert resp.status_code == 503
        assert "TWELVE_DATA_API_KEY" in resp.json()["message"]

    def test_service_exception_returns_400(self):
        with patch(
            "routers.stock.stock_svc.get_stock_details",
            new=AsyncMock(side_effect=Exception("upstream blew up")),
        ):
            resp = client.get("/api/stock/details/AAPL")
        assert resp.status_code == 400
        assert resp.json()["success"] is False
        assert "upstream blew up" in resp.json()["message"]


class TestGetMultipleQuotesExtra:
    def test_missing_provider_config_returns_503(self):
        with patch(
            "routers.stock.stock_svc.get_multiple_stock_quotes",
            new=AsyncMock(side_effect=CONFIG_ERROR),
        ):
            resp = client.post("/api/stock/quotes", json=["AAPL", "MSFT"])
        assert resp.status_code == 503
        assert "TWELVE_DATA_API_KEY" in resp.json()["message"]

    def test_service_exception_returns_400(self):
        with patch(
            "routers.stock.stock_svc.get_multiple_stock_quotes",
            new=AsyncMock(side_effect=Exception("provider timeout")),
        ):
            resp = client.post("/api/stock/quotes", json=["AAPL"])
        assert resp.status_code == 400
        assert resp.json()["success"] is False
        assert "provider timeout" in resp.json()["message"]


class TestGetHistoricalExtra:
    def test_missing_provider_config_returns_503(self):
        with patch(
            "routers.stock.stock_svc.get_historical_data",
            new=AsyncMock(side_effect=CONFIG_ERROR),
        ):
            resp = client.get("/api/stock/historical/AAPL")
        assert resp.status_code == 503
        assert "TWELVE_DATA_API_KEY" in resp.json()["message"]

    def test_service_exception_returns_400(self):
        with patch(
            "routers.stock.stock_svc.get_historical_data",
            new=AsyncMock(side_effect=Exception("rate limited")),
        ):
            resp = client.get("/api/stock/historical/AAPL")
        assert resp.status_code == 400
        assert resp.json()["success"] is False
        assert "rate limited" in resp.json()["message"]

    def test_query_params_are_forwarded(self):
        mock = AsyncMock(return_value=[])
        with patch("routers.stock.stock_svc.get_historical_data", new=mock):
            resp = client.get("/api/stock/historical/AAPL?interval=1week&outputSize=30")
        # Empty data still yields 404, but the params must reach the service.
        assert resp.status_code == 404
        mock.assert_awaited_once_with("AAPL", "1week", 30)
