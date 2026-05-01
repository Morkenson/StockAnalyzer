import pytest
from models.stock_models import StockQuote
from models.snaptrade_models import Account, Holding, Portfolio
from models.common import ApiResponse
from services.snaptrade_service import _parse_holding, _parse_account


class TestStockQuoteSerialization:
    def test_serializes_to_camel_case(self):
        q = StockQuote(symbol="AAPL", price=150.0, change=1.0, change_percent=0.67)
        d = q.model_dump(by_alias=True)
        assert "changePercent" in d
        assert "change_percent" not in d
        assert d["changePercent"] == pytest.approx(0.67)

    def test_symbol_and_price(self):
        q = StockQuote(symbol="MSFT", price=300.0)
        d = q.model_dump(by_alias=True)
        assert d["symbol"] == "MSFT"
        assert d["price"] == 300.0


class TestApiResponse:
    def test_wraps_data_with_success(self):
        q = StockQuote(symbol="AAPL", price=100.0)
        resp = ApiResponse(success=True, data=q)
        assert resp.success is True
        assert resp.data.symbol == "AAPL"
        assert resp.message is None

    def test_error_response(self):
        resp = ApiResponse(success=False, message="Not found")
        assert resp.success is False
        assert resp.data is None
        assert resp.message == "Not found"


class TestParseHolding:
    def test_gain_loss_calculation(self):
        h = _parse_holding({
            "symbol": "AAPL",
            "quantity": 10,
            "averagePurchasePrice": 100.0,
            "currentPrice": 120.0,
            "totalValue": 1200.0,
        })
        assert h.gain_loss == pytest.approx(200.0)
        assert h.gain_loss_percent == pytest.approx(20.0)

    def test_loss_scenario(self):
        h = _parse_holding({
            "symbol": "TSLA",
            "quantity": 5,
            "averagePurchasePrice": 200.0,
            "currentPrice": 150.0,
            "totalValue": 750.0,
        })
        assert h.gain_loss == pytest.approx(-250.0)
        assert h.gain_loss_percent == pytest.approx(-25.0)

    def test_zero_avg_price_no_divide_by_zero(self):
        h = _parse_holding({
            "symbol": "AAPL",
            "quantity": 10,
            "averagePurchasePrice": 0,
            "currentPrice": 100.0,
            "totalValue": 1000.0,
        })
        assert h.gain_loss_percent == 0.0

    def test_default_currency(self):
        h = _parse_holding({"symbol": "AAPL", "quantity": 1,
                            "averagePurchasePrice": 100, "currentPrice": 100, "totalValue": 100})
        assert h.currency == "USD"


class TestParseAccount:
    def test_basic_parsing(self):
        acc = _parse_account({
            "id": "acc-123",
            "name": "TFSA",
            "accountNumber": "001",
            "type": "TFSA",
            "brokerageId": "b1",
            "balance": 5000.0,
            "currency": "CAD",
        })
        assert acc.id == "acc-123"
        assert acc.balance == 5000.0
        assert acc.currency == "CAD"
