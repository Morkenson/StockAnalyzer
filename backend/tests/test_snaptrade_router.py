import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from db_models import AppUser
from main import app
from models.snaptrade_models import Account, Portfolio, Brokerage, Holding, RecurringInvestment, SnapTradeUser
from routers.snaptrade import _optional_current_user
from services.snaptrade_service import SnapTradeServiceError

FAKE_USER = AppUser(id="user1", email="test@example.com", password_hash="fake")
app.dependency_overrides[_optional_current_user] = lambda: FAKE_USER

client = TestClient(app)
HEADERS = {}

MOCK_PORTFOLIO = Portfolio(user_id="user1", accounts=[], total_balance=10000.0, total_gain_loss=500.0)
MOCK_PORTFOLIO_WITH_ACCOUNTS = Portfolio(
    user_id="user1",
    accounts=[
        Account(id="acc1", name="Brokerage", account_number="001", type="TFSA", brokerage_id="b1", balance=100),
        Account(id="acc2", name="Retirement", account_number="002", type="IRA", brokerage_id="b1", balance=200),
    ],
    total_balance=300,
    total_gain_loss=0,
)
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
            with patch("routers.snaptrade.snaptrade_svc.get_portfolio", new=AsyncMock(return_value=MOCK_PORTFOLIO)) as get_portfolio:
                with patch("routers.snaptrade.account_pref_svc.get_preferences", new=AsyncMock(return_value={})):
                    resp = client.get("/api/snaptrade/portfolio", headers=HEADERS)
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        get_portfolio.assert_awaited_once_with("user1", "secret", force_refresh=False)

    def test_refresh_bypasses_cache(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch("routers.snaptrade.snaptrade_svc.get_portfolio", new=AsyncMock(return_value=MOCK_PORTFOLIO)) as get_portfolio:
                with patch("routers.snaptrade.account_pref_svc.get_preferences", new=AsyncMock(return_value={})):
                    resp = client.get("/api/snaptrade/portfolio?refresh=true", headers=HEADERS)

        assert resp.status_code == 200
        get_portfolio.assert_awaited_once_with("user1", "secret", force_refresh=True)

    def test_applies_account_preferences(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch(
                "routers.snaptrade.snaptrade_svc.get_portfolio",
                new=AsyncMock(return_value=MOCK_PORTFOLIO_WITH_ACCOUNTS.model_copy(deep=True)),
            ):
                with patch(
                    "routers.snaptrade.account_pref_svc.get_preferences",
                    new=AsyncMock(return_value={"acc1": {"nickname": "Trading", "hidden": False}, "acc2": {"hidden": True}}),
                ):
                    resp = client.get("/api/snaptrade/portfolio", headers=HEADERS)

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalBalance"] == 100
        assert len(data["accounts"]) == 1
        assert data["accounts"][0]["nickname"] == "Trading"

    def test_snaptrade_service_error_returns_message_and_status(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch(
                "routers.snaptrade.snaptrade_svc.get_portfolio",
                new=AsyncMock(side_effect=SnapTradeServiceError("Account data is still syncing", status_code=425)),
            ):
                resp = client.get("/api/snaptrade/portfolio", headers=HEADERS)
        assert resp.status_code == 425
        assert resp.json()["message"] == "Account data is still syncing"


class TestInitiateConnection:
    def test_creates_user_and_stores_returned_secret(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value=None)):
            with patch("routers.snaptrade.user_svc.store_user_secret", new=AsyncMock()) as store_secret:
                with patch(
                    "routers.snaptrade.snaptrade_svc.create_user",
                    new=AsyncMock(return_value=SnapTradeUser(user_id="user1", user_secret="real-secret")),
                ):
                    with patch(
                        "routers.snaptrade.snaptrade_svc.initiate_connection",
                        new=AsyncMock(return_value="https://login.example"),
                    ) as initiate:
                        resp = client.post("/api/snaptrade/connect/initiate", headers={**HEADERS, "Origin": "http://localhost:4200"})

        assert resp.status_code == 200
        assert resp.json()["data"]["redirectUri"] == "https://login.example"
        store_secret.assert_awaited_once_with("user1", "real-secret")
        initiate.assert_awaited_once_with("user1", "real-secret", "http://localhost:4200/portfolio")

    def test_rejects_missing_user_secret_from_snaptrade(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value=None)):
            with patch(
                "routers.snaptrade.snaptrade_svc.create_user",
                new=AsyncMock(return_value=SnapTradeUser(user_id="user1")),
            ):
                resp = client.post("/api/snaptrade/connect/initiate", headers=HEADERS)

        assert resp.status_code == 400
        assert "user secret" in resp.json()["message"]


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


class TestRecurringInvestments:
    def test_no_user_secret_returns_404(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value=None)):
            resp = client.get("/api/snaptrade/recurring-investments", headers=HEADERS)

        assert resp.status_code == 404

    def test_success_applies_visible_accounts(self):
        recurring = [
            RecurringInvestment(
                symbol="META",
                account_id="acc1",
                account_name="Trading",
                amount=25,
                frequency="weekly",
                confidence=0.9,
                occurrences=3,
                last_date="2026-01-19",
                next_estimated_date="2026-01-26",
            )
        ]
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch(
                "routers.snaptrade.snaptrade_svc.get_accounts",
                new=AsyncMock(return_value=MOCK_PORTFOLIO_WITH_ACCOUNTS.accounts),
            ):
                with patch(
                    "routers.snaptrade.account_pref_svc.get_preferences",
                    new=AsyncMock(return_value={"acc1": {"nickname": "Trading", "hidden": False}, "acc2": {"hidden": True}}),
                ):
                    with patch(
                        "routers.snaptrade.snaptrade_svc.get_recurring_investments",
                        new=AsyncMock(return_value=recurring),
                    ) as get_recurring:
                        resp = client.get("/api/snaptrade/recurring-investments", headers=HEADERS)

        assert resp.status_code == 200
        assert resp.json()["data"][0]["symbol"] == "META"
        get_recurring.assert_awaited_once()
        accounts = get_recurring.await_args.kwargs["accounts"]
        assert [account.id for account in accounts] == ["acc1"]
        assert accounts[0].nickname == "Trading"
        assert get_recurring.await_args.kwargs["force_refresh"] is False

    def test_refresh_bypasses_cache(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch("routers.snaptrade.snaptrade_svc.get_accounts", new=AsyncMock(return_value=MOCK_ACCOUNTS)):
                with patch("routers.snaptrade.account_pref_svc.get_preferences", new=AsyncMock(return_value={})):
                    with patch(
                        "routers.snaptrade.snaptrade_svc.get_recurring_investments",
                        new=AsyncMock(return_value=[]),
                    ) as get_recurring:
                        resp = client.get("/api/snaptrade/recurring-investments?refresh=true", headers=HEADERS)

        assert resp.status_code == 200
        assert get_recurring.await_args.kwargs["force_refresh"] is True


class TestAccountPreferences:
    def test_update_preference(self):
        with patch(
            "routers.snaptrade.account_pref_svc.update_preference",
            new=AsyncMock(return_value={"accountId": "acc1", "nickname": "Trading", "hidden": False}),
        ) as update_pref:
            resp = client.patch(
                "/api/snaptrade/accounts/acc1/preference",
                json={"nickname": "Trading", "hidden": False},
                headers=HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["data"]["nickname"] == "Trading"
        update_pref.assert_awaited_once_with("user1", "acc1", nickname="Trading", hidden=False)

    def test_delete_hides_account(self):
        with patch(
            "routers.snaptrade.account_pref_svc.hide_account",
            new=AsyncMock(return_value={"accountId": "acc1", "hidden": True}),
        ) as hide_account:
            resp = client.delete("/api/snaptrade/accounts/acc1", headers=HEADERS)

        assert resp.status_code == 200
        assert resp.json()["data"]["hidden"] is True
        hide_account.assert_awaited_once_with("user1", "acc1")


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
