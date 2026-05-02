import pytest

from services import snaptrade_service as svc


class FakeResponse:
    def __init__(self, body):
        self.body = body


@pytest.mark.asyncio
async def test_create_user_maps_response(monkeypatch):
    class Authentication:
        async def aregister_snap_trade_user(self, body=None):
            assert body == {"userId": "user-1"}
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
        async def alist_all_brokerages(self):
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
        ):
            assert query_params == {"userId": "u", "userSecret": "s"}
            assert custom_redirect == "https://app"
            assert immediate_redirect is True
            assert show_close_button is False
            assert connection_portal_version == "v4"
            return FakeResponse({"redirectURI": "https://login.example"})

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"authentication": Authentication()})())

    assert await svc.initiate_connection("u", "s", "https://app") == "https://login.example"


@pytest.mark.asyncio
async def test_get_accounts_handles_wrapped_and_raw_lists(monkeypatch):
    class WrappedAccounts:
        async def alist_user_accounts(self, query_params=None):
            assert query_params == {"userId": "u", "userSecret": "s"}
            return FakeResponse({"accounts": [{"id": "a1", "name": "Brokerage", "balance": 10}]})

    monkeypatch.setattr(svc, "_sdk_client", lambda: type("Client", (), {"account_information": WrappedAccounts()})())
    wrapped_accounts = await svc.get_accounts("u", "s")

    class RawAccounts:
        async def alist_user_accounts(self, query_params=None):
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
        async def aget_user_holdings(self, account_id=None, query_params=None):
            assert account_id == "a1"
            assert query_params == {"userId": "u", "userSecret": "s"}
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
