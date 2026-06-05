import pytest
from datetime import date, timedelta

from services import snaptrade_service as svc


class FakeResponse:
    def __init__(self, body):
        self.body = body


def test_sdk_body_converts_nested_sdk_models():
    class Model:
        def to_dict(self):
            return {"accounts": [{"id": "a1", "balance": {"total": {"amount": 10}}}]}

    assert svc._sdk_body(FakeResponse(Model())) == {
        "accounts": [{"id": "a1", "balance": {"total": {"amount": 10}}}]
    }


def test_sdk_body_parses_raw_json_response():
    assert svc._sdk_body(FakeResponse(b'{"accounts":[{"id":"a1","status":null,"account_category":null}]}')) == {
        "accounts": [{"id": "a1", "status": None, "account_category": None}]
    }


def test_snaptrade_error_message_parses_generated_exception_body():
    class GeneratedException(Exception):
        def __str__(self):
            return (
                "(403)\nReason: Forbidden\n"
                "HTTP response body: {'detail': 'Feature is not enabled for this customer or this connection', "
                "'status_code': 403, 'code': '1141'}"
            )

    exc = GeneratedException()

    assert svc._snaptrade_error_message(exc) == "Feature is not enabled for this customer or this connection"
    assert svc._snaptrade_error_status(exc) == 403


@pytest.mark.asyncio
async def test_create_user_maps_response(monkeypatch):
    class Authentication:
        async def aregister_snap_trade_user(self, body=None, skip_deserialization=None):
            assert body == {"userId": "user-1"}
            assert skip_deserialization is False
            return FakeResponse(
                {
                    "userId": "user-1",
                    "userSecret": "secret-1",
                    "email": "a@example.com",
                    "createdAt": "2026-05-01T00:00:00Z",
                }
            )

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"authentication": Authentication()})())

    user = await svc.create_user("user-1")

    assert user.id == "user-1"
    assert user.user_id == "user-1"
    assert user.user_secret == "secret-1"


@pytest.mark.asyncio
async def test_get_brokerages_maps_response(monkeypatch):
    class ReferenceData:
        async def alist_all_brokerages(self, skip_deserialization=None):
            assert skip_deserialization is False
            return FakeResponse(
                {"brokerages": [{"id": "b1", "name": "Broker", "displayName": "Brokerage", "supportsOAuth": True}]}
            )

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"reference_data": ReferenceData()})())

    brokerages = await svc.get_brokerages()

    assert brokerages[0].display_name == "Brokerage"
    assert brokerages[0].supports_oauth is True


@pytest.mark.asyncio
async def test_initiate_connection_returns_login_link(monkeypatch):
    class Authentication:
        async def alogin_snap_trade_user(
            self,
            query_params=None,
            custom_redirect=None,
            immediate_redirect=None,
            show_close_button=None,
            connection_portal_version=None,
            skip_deserialization=None,
        ):
            assert query_params == {"userId": "u", "userSecret": "s"}
            assert custom_redirect == "https://app"
            assert immediate_redirect is True
            assert show_close_button is False
            assert connection_portal_version == "v4"
            assert skip_deserialization is True
            return FakeResponse({"redirectURI": "https://login.example"})

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"authentication": Authentication()})())

    assert await svc.initiate_connection("u", "s", "https://app") == "https://login.example"


@pytest.mark.asyncio
async def test_initiate_connection_handles_raw_string_response(monkeypatch):
    class Authentication:
        async def alogin_snap_trade_user(self, **kwargs):
            assert kwargs["skip_deserialization"] is True
            return FakeResponse('"https://login.example/raw"')

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"authentication": Authentication()})())

    assert await svc.initiate_connection("u", "s", "https://app") == "https://login.example/raw"


@pytest.mark.asyncio
async def test_get_accounts_handles_wrapped_and_raw_lists(monkeypatch):
    class WrappedAccounts:
        async def alist_user_accounts(self, query_params=None, skip_deserialization=None):
            assert query_params == {"userId": "u", "userSecret": "s"}
            assert skip_deserialization is True
            return FakeResponse({"accounts": [{"id": "a1", "name": "Brokerage", "balance": 10}]})

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"account_information": WrappedAccounts()})())
    wrapped_accounts = await svc.get_accounts("u", "s")

    class RawAccounts:
        async def alist_user_accounts(self, query_params=None, skip_deserialization=None):
            return FakeResponse([{"id": "a2", "name": "Other", "balance": 20}])

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"account_information": RawAccounts()})())
    raw_accounts = await svc.get_accounts("u", "s")

    assert wrapped_accounts[0].id == "a1"
    assert raw_accounts[0].id == "a2"


def test_parse_account_handles_current_snaptrade_shape():
    account = svc._parse_account(
        {
            "id": "a1",
            "name": "Robinhood Individual",
            "number": "Q654",
            "brokerage_authorization": "auth-1",
            "raw_type": "Margin",
            "balance": {"total": {"amount": 15363.23, "currency": "USD"}},
        }
    )

    assert account.account_number == "Q654"
    assert account.brokerage_id == "auth-1"
    assert account.type == "Margin"
    assert account.balance == 15363.23


@pytest.mark.asyncio
async def test_get_account_holdings_maps_positions(monkeypatch):
    class AccountInformation:
        async def aget_user_holdings(self, account_id=None, query_params=None, skip_deserialization=None):
            assert account_id == "a1"
            assert query_params == {"userId": "u", "userSecret": "s"}
            assert skip_deserialization is True
            return FakeResponse(
                {
                    "positions": [
                        {
                            "symbol": "AAPL",
                            "quantity": "2",
                            "averagePurchasePrice": "100",
                            "currentPrice": "125",
                            "currency": "USD",
                        }
                    ]
                }
            )

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"account_information": AccountInformation()})())

    holdings = await svc.get_account_holdings("u", "s", "a1")

    assert holdings[0].gain_loss == 50
    assert holdings[0].gain_loss_percent == 25


@pytest.mark.asyncio
async def test_get_account_activities_uses_raw_buy_activity_response(monkeypatch):
    class AccountInformation:
        async def aget_account_activities(
            self,
            account_id=None,
            user_id=None,
            user_secret=None,
            start_date=None,
            end_date=None,
            limit=None,
            type=None,
            skip_deserialization=None,
        ):
            assert account_id == "a1"
            assert user_id == "u"
            assert user_secret == "s"
            assert start_date == date(2026, 1, 1)
            assert end_date == date(2026, 2, 1)
            assert limit == 1000
            assert type == "BUY"
            assert skip_deserialization is True
            return FakeResponse({"data": [{"type": "BUY", "amount": -25}]})

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"account_information": AccountInformation()})())

    activities = await svc.get_account_activities(
        "u",
        "s",
        "a1",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 2, 1),
    )

    assert activities == [{"type": "BUY", "amount": -25}]


def test_infer_recurring_from_weekly_buy_activities():
    account = svc.Account(id="a1", name="Robinhood Individual", account_number="", type="", brokerage_id="")
    buys = [
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "META"},
                "type": "BUY",
                "amount": -25.0,
                "trade_date": "2026-01-05T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "META"},
                "type": "BUY",
                "amount": -25.5,
                "trade_date": "2026-01-12T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "META"},
                "type": "BUY",
                "amount": -24.75,
                "trade_date": "2026-01-19T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
    ]

    recurring = svc._infer_recurring_from_buys([buy for buy in buys if buy])

    assert len(recurring) == 1
    assert recurring[0].symbol == "META"
    assert recurring[0].frequency == "weekly"
    assert recurring[0].amount == 25.0
    assert recurring[0].occurrences == 3
    assert recurring[0].next_estimated_date == "2026-01-26"


def test_infer_recurring_from_daily_buy_activities():
    account = svc.Account(id="a1", name="Robinhood Individual", account_number="", type="", brokerage_id="")
    buys = [
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "VOO"},
                "type": "BUY",
                "amount": -10.0,
                "trade_date": "2026-01-05T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "VOO"},
                "type": "BUY",
                "amount": -10.25,
                "trade_date": "2026-01-06T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "VOO"},
                "type": "BUY",
                "amount": -9.75,
                "trade_date": "2026-01-07T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "VOO"},
                "type": "BUY",
                "amount": -10.0,
                "trade_date": "2026-01-08T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "VOO"},
                "type": "BUY",
                "amount": -10.1,
                "trade_date": "2026-01-09T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
    ]

    recurring = svc._infer_recurring_from_buys([buy for buy in buys if buy])

    assert len(recurring) == 1
    assert recurring[0].symbol == "VOO"
    assert recurring[0].frequency == "daily"
    assert recurring[0].amount == 10.0
    assert recurring[0].occurrences == 5
    assert recurring[0].next_estimated_date == "2026-01-10"


def test_infer_recurring_rejects_short_daily_buy_streak():
    account = svc.Account(id="a1", name="Robinhood Individual", account_number="", type="", brokerage_id="")
    buys = [
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "META"},
                "type": "BUY",
                "amount": -50.0,
                "trade_date": "2026-01-05T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "META"},
                "type": "BUY",
                "amount": -50.0,
                "trade_date": "2026-01-06T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "META"},
                "type": "BUY",
                "amount": -50.0,
                "trade_date": "2026-01-07T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
    ]

    recurring = svc._infer_recurring_from_buys([buy for buy in buys if buy])

    assert recurring == []


def test_infer_recurring_requires_at_least_three_buy_activities():
    account = svc.Account(id="a1", name="Crypto", account_number="", type="", brokerage_id="")
    buys = [
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "SOL"},
                "type": "BUY",
                "amount": -19.83,
                "trade_date": "2026-01-05T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
        svc._parse_buy_activity(
            {
                "symbol": {"symbol": "SOL"},
                "type": "BUY",
                "amount": -19.84,
                "trade_date": "2026-01-06T10:00:00Z",
                "currency": {"code": "USD"},
            },
            account,
        ),
    ]

    recurring = svc._infer_recurring_from_buys([buy for buy in buys if buy])

    assert recurring == []


def test_parse_holding_handles_current_snaptrade_position_shape():
    holding = svc._parse_holding(
        {
            "symbol": {"symbol": {"symbol": "VAB.TO", "currency": {"code": "CAD"}}},
            "units": "10",
            "price": "120",
            "average_purchase_price": "100",
            "total_value": {"value": "1200", "currency": "CAD"},
        }
    )

    assert holding.symbol == "VAB.TO"
    assert holding.quantity == 10
    assert holding.current_price == 120
    assert holding.currency == "CAD"


def test_parse_dividend_activity_uses_absolute_nonzero_amount():
    account = svc.Account(id="a1", name="Brokerage", account_number="", type="", brokerage_id="")

    parsed = svc._parse_dividend_activity(
        {
            "symbol": {"symbol": {"symbol": "SCHD"}},
            "type": "DIVIDEND",
            "amount": "-12.34",
            "trade_date": "2026-04-01T00:00:00Z",
            "currency": {"code": "USD"},
        },
        account,
    )

    assert parsed
    assert parsed["symbol"] == "SCHD"
    assert parsed["amount"] == 12.34
    assert parsed["currency"] == "USD"


def test_parse_dividend_activity_ignores_zero_or_non_dividend():
    account = svc.Account(id="a1", name="Brokerage", account_number="", type="", brokerage_id="")

    assert svc._parse_dividend_activity({"type": "BUY", "amount": "10", "trade_date": "2026-04-01"}, account) is None
    assert svc._parse_dividend_activity({"type": "DIVIDEND", "amount": "0", "trade_date": "2026-04-01"}, account) is None


@pytest.mark.asyncio
async def test_get_portfolio_sums_accounts_and_skips_failed_holdings(monkeypatch):
    accounts = [
        svc.Account(id="a1", name="One", account_number="", type="", brokerage_id="", balance=300, currency="USD"),
        svc.Account(id="a2", name="Two", account_number="", type="", brokerage_id="", balance=100, currency="USD"),
    ]

    async def fake_accounts(user_id, user_secret):
        return accounts

    async def fake_holdings(user_id, user_secret, account_id):
        if account_id == "a2":
            raise RuntimeError("nope")
        return [svc.Holding(symbol="AAPL", quantity=1, average_purchase_price=100, current_price=150, total_value=150, gain_loss=50, gain_loss_percent=50)]

    monkeypatch.setattr(svc, "get_accounts", fake_accounts)
    monkeypatch.setattr(svc, "get_account_holdings", fake_holdings)

    portfolio = await svc.get_portfolio("u", "s")

    assert portfolio.total_balance == 400
    assert portfolio.total_gain_loss == 50
    assert accounts[0].holdings[0].symbol == "AAPL"
    assert accounts[1].holdings == []


@pytest.mark.asyncio
async def test_get_portfolio_uses_cache(monkeypatch):
    calls = {"accounts": 0}

    async def fake_accounts(user_id, user_secret):
        calls["accounts"] += 1
        return [svc.Account(id="a1", name="One", account_number="", type="", brokerage_id="", balance=100)]

    async def fake_holdings(user_id, user_secret, account_id):
        return []

    monkeypatch.setattr(svc, "get_accounts", fake_accounts)
    monkeypatch.setattr(svc, "get_account_holdings", fake_holdings)

    first = await svc.get_portfolio("u", "s")
    second = await svc.get_portfolio("u", "s")

    assert first.total_balance == 100
    assert second.total_balance == 100
    assert calls["accounts"] == 1


@pytest.mark.asyncio
async def test_get_portfolio_force_refresh_bypasses_cache(monkeypatch):
    calls = {"accounts": 0}

    async def fake_accounts(user_id, user_secret):
        calls["accounts"] += 1
        return [svc.Account(id=f"a{calls['accounts']}", name="One", account_number="", type="", brokerage_id="", balance=100)]

    async def fake_holdings(user_id, user_secret, account_id):
        return []

    monkeypatch.setattr(svc, "get_accounts", fake_accounts)
    monkeypatch.setattr(svc, "get_account_holdings", fake_holdings)

    await svc.get_portfolio("u", "s")
    refreshed = await svc.get_portfolio("u", "s", force_refresh=True)

    assert refreshed.accounts[0].id == "a2"
    assert calls["accounts"] == 2


@pytest.mark.asyncio
async def test_get_recurring_investments_uses_cache(monkeypatch):
    calls = {"activities": 0}
    accounts = [
        svc.Account(
            id="a1",
            name="One",
            account_number="",
            type="",
            brokerage_id="",
            holdings=[svc.Holding(symbol="META", quantity=1)],
        )
    ]

    async def fake_activities(user_id, user_secret, account_id, start_date=None, end_date=None):
        calls["activities"] += 1
        return [
            {"symbol": {"symbol": "META"}, "type": "BUY", "amount": -25, "trade_date": "2026-01-05T00:00:00Z"},
            {"symbol": {"symbol": "META"}, "type": "BUY", "amount": -25, "trade_date": "2026-01-12T00:00:00Z"},
            {"symbol": {"symbol": "META"}, "type": "BUY", "amount": -25, "trade_date": "2026-01-19T00:00:00Z"},
        ]

    monkeypatch.setattr(svc, "get_account_activities", fake_activities)

    first = await svc.get_recurring_investments("u", "s", accounts=accounts)
    second = await svc.get_recurring_investments("u", "s", accounts=accounts)

    assert first[0].symbol == "META"
    assert second[0].symbol == "META"
    assert calls["activities"] == 1


@pytest.mark.asyncio
async def test_get_recurring_investments_requires_current_holding(monkeypatch):
    accounts = [
        svc.Account(
            id="a1",
            name="One",
            account_number="",
            type="",
            brokerage_id="",
            holdings=[svc.Holding(symbol="AAPL", quantity=1)],
        )
    ]

    async def fake_activities(user_id, user_secret, account_id, start_date=None, end_date=None):
        return [
            {"symbol": {"symbol": "META"}, "type": "BUY", "amount": -25, "trade_date": "2026-01-05T00:00:00Z"},
            {"symbol": {"symbol": "META"}, "type": "BUY", "amount": -25, "trade_date": "2026-01-12T00:00:00Z"},
            {"symbol": {"symbol": "META"}, "type": "BUY", "amount": -25, "trade_date": "2026-01-19T00:00:00Z"},
        ]

    monkeypatch.setattr(svc, "get_account_activities", fake_activities)

    recurring = await svc.get_recurring_investments("u", "s", accounts=accounts)

    assert recurring == []


@pytest.mark.asyncio
async def test_get_dividend_income_sums_by_currency_account_and_symbol(monkeypatch):
    today = date.today()
    accounts = [
        svc.Account(
            id="a1",
            name="Taxable",
            nickname="Trading",
            account_number="",
            type="",
            brokerage_id="",
            holdings=[svc.Holding(symbol="SCHD", quantity=4)],
        ),
        svc.Account(
            id="a2",
            name="IRA",
            account_number="",
            type="",
            brokerage_id="",
            holdings=[svc.Holding(symbol="VAB.TO", quantity=5)],
        ),
    ]

    async def fake_activities(user_id, user_secret, account_id, start_date=None, end_date=None, activity_type="BUY"):
        assert activity_type == "DIVIDEND"
        assert start_date == today - timedelta(days=365)
        assert end_date == today
        if account_id == "a1":
            return [
                {
                    "symbol": {"symbol": "SCHD"},
                    "type": "DIVIDEND",
                    "amount": "-10.25",
                    "units": "2",
                    "trade_date": today.isoformat(),
                    "currency": {"code": "USD"},
                },
                {
                    "symbol": {"symbol": "SCHD"},
                    "type": "DIVIDEND",
                    "amount": "4.75",
                    "units": "1",
                    "trade_date": (today - timedelta(days=30)).isoformat(),
                    "currency": {"code": "USD"},
                },
                {"symbol": "SCHD", "type": "DIVIDEND", "amount": "0", "trade_date": today.isoformat()},
                {"symbol": "OLD", "type": "DIVIDEND", "amount": "99", "trade_date": today.isoformat()},
            ]
        return [
            {
                "symbol": {"symbol": "VAB.TO"},
                "type": "DIVIDEND",
                "amount": "7",
                "units": "7",
                "trade_date": (today - timedelta(days=10)).isoformat(),
                "currency": {"code": "CAD"},
            }
        ]

    monkeypatch.setattr(svc, "get_account_activities", fake_activities)

    summary = await svc.get_dividend_income("u", "s", accounts=accounts)

    assert [(total.currency, total.annual_income, total.monthly_income) for total in summary.totals] == [
        ("CAD", 5.0, 0.42),
        ("USD", 237.0, 19.75),
    ]
    assert summary.payment_count == 3
    assert summary.last_payment_date == today.isoformat()
    assert summary.accounts[1].account_name == "Trading"
    assert summary.symbols[1].account_id == "a1"
    assert summary.symbols[1].account_name == "Trading"
    assert summary.symbols[1].symbol == "SCHD"
    assert summary.symbols[1].current_quantity == 4
    assert summary.symbols[1].average_payment_per_share == 4.9375
    assert summary.symbols[1].payment_frequency == "monthly"
    assert summary.symbols[1].payments_per_year == 12
    assert summary.symbols[1].payment_count == 2


@pytest.mark.asyncio
async def test_get_dividend_income_annualizes_quarterly_cadence(monkeypatch):
    today = date.today()
    accounts = [
        svc.Account(
            id="a1",
            name="Taxable",
            account_number="",
            type="",
            brokerage_id="",
            holdings=[svc.Holding(symbol="VTI", quantity=10)],
        )
    ]

    async def fake_activities(user_id, user_secret, account_id, start_date=None, end_date=None, activity_type="BUY"):
        return [
            {
                "symbol": "VTI",
                "type": "DIVIDEND",
                "amount": "8",
                "units": "10",
                "trade_date": today.isoformat(),
            },
            {
                "symbol": "VTI",
                "type": "DIVIDEND",
                "amount": "10",
                "units": "10",
                "trade_date": (today - timedelta(days=91)).isoformat(),
            },
        ]

    monkeypatch.setattr(svc, "get_account_activities", fake_activities)

    summary = await svc.get_dividend_income("u", "s", accounts=accounts)

    assert summary.totals[0].annual_income == 36
    assert summary.totals[0].monthly_income == 3
    assert summary.symbols[0].payment_frequency == "quarterly"
    assert summary.symbols[0].payments_per_year == 4
    assert summary.symbols[0].average_payment_per_share == 0.9

    overridden = await svc.get_dividend_income(
        "u",
        "s",
        accounts=accounts,
        force_refresh=True,
        frequency_overrides={("VTI", "USD"): {"payment_frequency": "monthly", "payments_per_year": 12}},
    )

    assert overridden.totals[0].annual_income == 108
    assert overridden.symbols[0].payment_frequency == "monthly"
    assert overridden.symbols[0].payments_per_year == 12


@pytest.mark.asyncio
async def test_get_dividend_income_uses_cache_and_force_refresh(monkeypatch):
    calls = {"activities": 0}
    accounts = [
        svc.Account(
            id="a1",
            name="Taxable",
            account_number="",
            type="",
            brokerage_id="",
            holdings=[svc.Holding(symbol="AAPL", quantity=1)],
        )
    ]

    async def fake_activities(user_id, user_secret, account_id, start_date=None, end_date=None, activity_type="BUY"):
        calls["activities"] += 1
        return [
            {
                "symbol": {"symbol": "AAPL"},
                "type": "DIVIDEND",
                "amount": str(calls["activities"]),
                "trade_date": date.today().isoformat(),
            }
        ]

    monkeypatch.setattr(svc, "get_account_activities", fake_activities)

    first = await svc.get_dividend_income("u", "s", accounts=accounts)
    second = await svc.get_dividend_income("u", "s", accounts=accounts)
    refreshed = await svc.get_dividend_income("u", "s", accounts=accounts, force_refresh=True)

    assert first.totals[0].annual_income == 1
    assert second.totals[0].annual_income == 1
    assert refreshed.totals[0].annual_income == 2
    assert calls["activities"] == 2


@pytest.mark.asyncio
async def test_get_dividend_income_returns_empty_without_current_holdings(monkeypatch):
    calls = {"activities": 0}
    accounts = [svc.Account(id="a1", name="Taxable", account_number="", type="", brokerage_id="")]

    async def fake_activities(*args, **kwargs):
        calls["activities"] += 1
        return [{"symbol": "AAPL", "type": "DIVIDEND", "amount": "10", "trade_date": date.today().isoformat()}]

    monkeypatch.setattr(svc, "get_account_activities", fake_activities)

    summary = await svc.get_dividend_income("u", "s", accounts=accounts)

    assert summary.totals == []
    assert summary.symbols == []
    assert calls["activities"] == 0
