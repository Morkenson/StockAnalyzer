import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from db_models import AppUser
from main import app
from models.snaptrade_models import (
    Account,
    Brokerage,
    DividendIncomeSummary,
    DividendIncomeTotal,
    Holding,
    Portfolio,
    RecurringInvestment,
    SnapTradeUser,
)
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
    def test_requires_authentication(self):
        app.dependency_overrides[_optional_current_user] = lambda: None
        try:
            resp = client.get("/api/snaptrade/portfolio", headers=HEADERS)
        finally:
            app.dependency_overrides[_optional_current_user] = lambda: FAKE_USER

        assert resp.status_code == 401
        assert resp.json()["message"] == "Authentication required"

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

    def test_success_saves_daily_snapshot(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch(
                "routers.snaptrade.snaptrade_svc.get_portfolio",
                new=AsyncMock(return_value=MOCK_PORTFOLIO_WITH_ACCOUNTS.model_copy(deep=True)),
            ):
                with patch("routers.snaptrade.account_pref_svc.get_preferences", new=AsyncMock(return_value={})):
                    resp = client.get("/api/snaptrade/portfolio", headers=HEADERS)

        assert resp.status_code == 200
        snapshots = client.get("/api/snaptrade/portfolio/snapshots", headers=HEADERS)
        assert snapshots.status_code == 200
        assert snapshots.json()["data"][0]["totalBalance"] == 300
        assert snapshots.json()["data"][0]["accountCount"] == 2


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
                "routers.snaptrade.snaptrade_svc.get_portfolio",
                new=AsyncMock(return_value=MOCK_PORTFOLIO_WITH_ACCOUNTS),
            ):
                with patch(
                    "routers.snaptrade.account_pref_svc.get_preferences",
                    new=AsyncMock(return_value={"acc1": {"nickname": "Trading", "hidden": False}, "acc2": {"hidden": True}}),
                ):
                    with patch(
                        "routers.snaptrade.snaptrade_svc.get_recurring_investments",
                        new=AsyncMock(return_value=recurring),
                    ) as get_recurring:
                        with patch(
                            "routers.snaptrade.recurring_pref_svc.get_preferences",
                            new=AsyncMock(
                                return_value={
                                    ("acc1", "META", "USD"): {
                                        "amount": 30,
                                        "frequency": "daily",
                                        "hidden": False,
                                    }
                                }
                            ),
                        ):
                            resp = client.get("/api/snaptrade/recurring-investments", headers=HEADERS)

        assert resp.status_code == 200
        assert resp.json()["data"][0]["symbol"] == "META"
        assert resp.json()["data"][0]["amount"] == 30
        assert resp.json()["data"][0]["frequency"] == "daily"
        get_recurring.assert_awaited_once()
        accounts = get_recurring.await_args.kwargs["accounts"]
        assert [account.id for account in accounts] == ["acc1"]
        assert accounts[0].nickname == "Trading"
        assert get_recurring.await_args.kwargs["force_refresh"] is False

    def test_refresh_bypasses_cache(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch("routers.snaptrade.snaptrade_svc.get_portfolio", new=AsyncMock(return_value=MOCK_PORTFOLIO_WITH_ACCOUNTS)):
                with patch("routers.snaptrade.account_pref_svc.get_preferences", new=AsyncMock(return_value={})):
                    with patch(
                        "routers.snaptrade.snaptrade_svc.get_recurring_investments",
                        new=AsyncMock(return_value=[]),
                    ) as get_recurring:
                        resp = client.get("/api/snaptrade/recurring-investments?refresh=true", headers=HEADERS)

        assert resp.status_code == 200
        assert get_recurring.await_args.kwargs["force_refresh"] is True

    def test_update_recurring_preference(self):
        with patch("routers.snaptrade._assert_account_owned_by_user", new=AsyncMock()):
            with patch(
                "routers.snaptrade.recurring_pref_svc.update_preference",
                new=AsyncMock(
                    return_value={
                        "accountId": "acc1",
                        "symbol": "BNDI",
                        "currency": "USD",
                        "amount": 22,
                        "frequency": "daily",
                        "hidden": False,
                    }
                ),
            ) as update_pref:
                resp = client.patch(
                    "/api/snaptrade/recurring-investments/preferences",
                    headers=HEADERS,
                    json={"accountId": "acc1", "symbol": "BNDI", "currency": "USD", "amount": 22, "frequency": "daily"},
                )

        assert resp.status_code == 200
        assert resp.json()["data"]["amount"] == 22
        update_pref.assert_awaited_once_with(
            "user1",
            "acc1",
            "BNDI",
            currency="USD",
            amount=22.0,
            frequency="daily",
            hidden=None,
        )

    def test_hide_recurring_preference(self):
        with patch("routers.snaptrade._assert_account_owned_by_user", new=AsyncMock()):
            with patch(
                "routers.snaptrade.recurring_pref_svc.update_preference",
                new=AsyncMock(
                    return_value={
                        "accountId": "acc1",
                        "symbol": "BNDI",
                        "currency": "USD",
                        "amount": None,
                        "frequency": None,
                        "hidden": True,
                    }
                ),
            ) as update_pref:
                resp = client.request(
                    "DELETE",
                    "/api/snaptrade/recurring-investments/preferences",
                    headers=HEADERS,
                    json={"accountId": "acc1", "symbol": "BNDI", "currency": "USD"},
                )

        assert resp.status_code == 200
        assert resp.json()["data"]["hidden"] is True
        update_pref.assert_awaited_once_with("user1", "acc1", "BNDI", currency="USD", hidden=True)

    def test_clear_account_recurring_preferences(self):
        with patch("routers.snaptrade._assert_account_owned_by_user", new=AsyncMock()):
            with patch(
                "routers.snaptrade.recurring_pref_svc.clear_account_preferences",
                new=AsyncMock(return_value={"accountId": "acc1", "removed": 2}),
            ) as clear_prefs:
                with patch("routers.snaptrade.snaptrade_svc.clear_recurring_investments_cache") as clear_cache:
                    resp = client.delete("/api/snaptrade/recurring-investments/preferences/accounts/acc1", headers=HEADERS)

        assert resp.status_code == 200
        assert resp.json()["data"] == {"accountId": "acc1", "removed": 2}
        clear_prefs.assert_awaited_once_with("user1", "acc1")
        clear_cache.assert_called_once_with("user1")


class TestDividendIncome:
    def test_no_user_secret_returns_404(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value=None)):
            resp = client.get("/api/snaptrade/dividend-income", headers=HEADERS)

        assert resp.status_code == 404

    def test_success_applies_visible_accounts(self):
        summary = DividendIncomeSummary(
            user_id="user1",
            totals=[DividendIncomeTotal(currency="USD", annual_income=120, monthly_income=10)],
            payment_count=4,
            last_payment_date="2026-04-01",
        )
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch(
                "routers.snaptrade.snaptrade_svc.get_portfolio",
                new=AsyncMock(return_value=MOCK_PORTFOLIO_WITH_ACCOUNTS.model_copy(deep=True)),
            ) as get_portfolio:
                with patch(
                    "routers.snaptrade.account_pref_svc.get_preferences",
                    new=AsyncMock(return_value={"acc1": {"nickname": "Trading", "hidden": False}, "acc2": {"hidden": True}}),
                ):
                    with patch("routers.snaptrade.dividend_pref_svc.get_preferences", new=AsyncMock(return_value={})):
                        with patch(
                            "routers.snaptrade.snaptrade_svc.get_dividend_income",
                            new=AsyncMock(return_value=summary),
                        ) as get_dividend_income:
                            resp = client.get("/api/snaptrade/dividend-income", headers=HEADERS)

        assert resp.status_code == 200
        assert resp.json()["data"]["totals"][0]["annualIncome"] == 120
        get_portfolio.assert_awaited_once_with("user1", "secret", force_refresh=False)
        get_dividend_income.assert_awaited_once()
        accounts = get_dividend_income.await_args.kwargs["accounts"]
        assert [account.id for account in accounts] == ["acc1"]
        assert accounts[0].nickname == "Trading"
        assert get_dividend_income.await_args.kwargs["force_refresh"] is False
        assert get_dividend_income.await_args.kwargs["frequency_overrides"] == {}

    def test_refresh_bypasses_cache(self):
        with patch("routers.snaptrade.user_svc.get_user_secret", new=AsyncMock(return_value="secret")):
            with patch(
                "routers.snaptrade.snaptrade_svc.get_portfolio",
                new=AsyncMock(return_value=Portfolio(user_id="user1", accounts=MOCK_ACCOUNTS)),
            ) as get_portfolio:
                with patch("routers.snaptrade.account_pref_svc.get_preferences", new=AsyncMock(return_value={})):
                    with patch("routers.snaptrade.dividend_pref_svc.get_preferences", new=AsyncMock(return_value={})):
                        with patch(
                            "routers.snaptrade.snaptrade_svc.get_dividend_income",
                            new=AsyncMock(return_value=DividendIncomeSummary(user_id="user1")),
                        ) as get_dividend_income:
                            resp = client.get("/api/snaptrade/dividend-income?refresh=true", headers=HEADERS)

        assert resp.status_code == 200
        get_portfolio.assert_awaited_once_with("user1", "secret", force_refresh=True)
        assert get_dividend_income.await_args.kwargs["force_refresh"] is True

    def test_update_frequency_preference(self):
        with patch(
            "routers.snaptrade.dividend_pref_svc.update_preference",
            new=AsyncMock(
                return_value={
                    "symbol": "SCHD",
                    "currency": "USD",
                    "paymentFrequency": "monthly",
                    "paymentsPerYear": 12,
                }
            ),
        ) as update_preference:
            with patch("routers.snaptrade.snaptrade_svc.clear_user_cache") as clear_cache:
                resp = client.patch(
                    "/api/snaptrade/dividend-income/preferences",
                    json={"symbol": "schd", "currency": "usd", "paymentFrequency": "monthly"},
                    headers=HEADERS,
                )

        assert resp.status_code == 200
        assert resp.json()["data"]["paymentFrequency"] == "monthly"
        update_preference.assert_awaited_once_with("user1", "schd", "monthly", currency="usd", hidden=None)
        clear_cache.assert_called_once_with("user1")

    def test_update_frequency_preference_rejects_invalid_frequency(self):
        with patch(
            "routers.snaptrade.dividend_pref_svc.update_preference",
            new=AsyncMock(side_effect=ValueError("paymentFrequency is invalid")),
        ):
            resp = client.patch(
                "/api/snaptrade/dividend-income/preferences",
                json={"symbol": "SCHD", "currency": "USD", "paymentFrequency": "sometimes"},
                headers=HEADERS,
            )

        assert resp.status_code == 400

    def test_hide_dividend_preference(self):
        with patch(
            "routers.snaptrade.dividend_pref_svc.update_preference",
            new=AsyncMock(
                return_value={
                    "symbol": "SCHD",
                    "currency": "USD",
                    "paymentFrequency": "monthly",
                    "paymentsPerYear": 12,
                    "hidden": True,
                }
            ),
        ) as update_preference:
            with patch("routers.snaptrade.snaptrade_svc.clear_user_cache") as clear_cache:
                resp = client.request(
                    "DELETE",
                    "/api/snaptrade/dividend-income/preferences",
                    json={"symbol": "SCHD", "currency": "USD", "paymentFrequency": "monthly"},
                    headers=HEADERS,
                )

        assert resp.status_code == 200
        assert resp.json()["data"]["hidden"] is True
        update_preference.assert_awaited_once_with("user1", "SCHD", "monthly", currency="USD", hidden=True)
        clear_cache.assert_called_once_with("user1")


class TestAccountPreferences:
    def test_update_preference(self):
        with patch("routers.snaptrade._assert_account_owned_by_user", new=AsyncMock()):
            with patch(
                "routers.snaptrade.account_pref_svc.update_preference",
                new=AsyncMock(
                    return_value={
                        "accountId": "acc1",
                        "nickname": "Trading",
                        "marginBalance": 1250,
                        "marginInterestRate": 12.5,
                        "hidden": False,
                    }
                ),
            ) as update_pref:
                resp = client.patch(
                    "/api/snaptrade/accounts/acc1/preference",
                    json={"nickname": "Trading", "marginBalance": 1250, "marginInterestRate": 12.5, "hidden": False},
                    headers=HEADERS,
                )

        assert resp.status_code == 200
        assert resp.json()["data"]["nickname"] == "Trading"
        assert resp.json()["data"]["marginBalance"] == 1250
        assert resp.json()["data"]["marginInterestRate"] == 12.5
        update_pref.assert_awaited_once_with(
            "user1",
            "acc1",
            nickname="Trading",
            margin_balance=1250.0,
            margin_interest_rate=12.5,
            hidden=False,
        )

    def test_delete_hides_account(self):
        with patch("routers.snaptrade._assert_account_owned_by_user", new=AsyncMock()):
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
