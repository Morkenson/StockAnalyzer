import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from main import app
from models.snaptrade_models import Account, Portfolio, Brokerage, Holding

client = TestClient(app)
HEADERS = {"X-User-Id": "user1"}

MOCK_PORTFOLIO = Portfolio(user_id="user1", accounts=[], total_balance=10000.0, total_gain_loss=500.0)
MOCK_ACCOUNTS = [Account(id="acc1", name="TFSA", account_number="001", type="TFSA", brokerage_id="b1")]
MOCK_BROKERAGES = [Brokerage(id="b1", name="Questrade", display_name="Questrade", supports_oauth=True)]
MOCK_HOLDINGS = [Holding(symbol="AAPL", quantity=10, average_purchase_price=100,
                          current_price=150, total_value=1500, gain_loss=500, gain_loss_percent=50)]


class TestGetPortfolio:
    def test_no_user_secret_returns_404(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value=None)):
            resp = client.get("/api/snaptrade/portfolio", headers=HEADERS)
        assert resp.status_code == 404
        assert resp.json()["success"] is False

    def test_success(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch("routers.snaptrade.snaptrade_svc.get_portfolio", new=AsyncMock(return_value=MOCK_PORTFOLIO)):
                resp = client.get("/api/snaptrade/portfolio", headers=HEADERS)
        assert resp.status_code == 200
        assert resp.json()["success"] is True


class TestGetAccounts:
    def test_no_user_secret_returns_404(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value=None)):
            resp = client.get("/api/snaptrade/accounts", headers=HEADERS)
        assert resp.status_code == 404

    def test_success(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch("routers.snaptrade.snaptrade_svc.get_accounts", new=AsyncMock(return_value=MOCK_ACCOUNTS)):
                resp = client.get("/api/snaptrade/accounts", headers=HEADERS)
        assert resp.status_code == 200
        assert resp.json()["data"][0]["id"] == "acc1"


class TestGetAccountHoldings:
    def test_no_user_secret_returns_404(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value=None)):
            resp = client.get("/api/snaptrade/accounts/acc1/holdings", headers=HEADERS)
        assert resp.status_code == 404

    def test_success(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch("routers.snaptrade.snaptrade_svc.get_account_holdings", new=AsyncMock(return_value=MOCK_HOLDINGS)):
                resp = client.get("/api/snaptrade/accounts/acc1/holdings", headers=HEADERS)
        assert resp.status_code == 200
        assert resp.json()["data"][0]["symbol"] == "AAPL"


class TestGetBrokerages:
    def test_success(self):
        with patch("routers.snaptrade.snaptrade_svc.get_brokerages", new=AsyncMock(return_value=MOCK_BROKERAGES)):
            resp = client.get("/api/snaptrade/brokerages")
        assert resp.status_code == 200
        assert resp.json()["data"][0]["name"] == "Questrade"

    def test_service_error_returns_400(self):
        with patch("routers.snaptrade.snaptrade_svc.get_brokerages", new=AsyncMock(side_effect=Exception("API error"))):
            resp = client.get("/api/snaptrade/brokerages")
        assert resp.status_code == 400
        assert resp.json()["success"] is False
