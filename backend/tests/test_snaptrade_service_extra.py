import pytest

from services import snaptrade_service as svc


@pytest.mark.asyncio
async def test_create_user_maps_response(monkeypatch):
    async def fake_post(path, json):
        assert path.endswith("/register")
        return {"id": "snap-id", "email": "a@example.com", "createdAt": "2026-05-01T00:00:00Z"}

    monkeypatch.setattr(svc, "_apost", fake_post)

    user = await svc.create_user("user-1")

    assert user.id == "snap-id"
    assert user.user_id == "user-1"


@pytest.mark.asyncio
async def test_get_brokerages_maps_response(monkeypatch):
    async def fake_get(path, params=None):
        return {"brokerages": [{"id": "b1", "name": "Broker", "displayName": "Brokerage", "supportsOAuth": True}]}

    monkeypatch.setattr(svc, "_aget", fake_get)

    brokerages = await svc.get_brokerages()

    assert brokerages[0].display_name == "Brokerage"
    assert brokerages[0].supports_oauth is True


@pytest.mark.asyncio
async def test_initiate_connection_returns_login_link(monkeypatch):
    async def fake_post(path, json):
        return {"loginLink": "https://login.example"}

    monkeypatch.setattr(svc, "_apost", fake_post)

    assert await svc.initiate_connection("u", "s", "https://app") == "https://login.example"


@pytest.mark.asyncio
async def test_get_accounts_handles_wrapped_and_raw_lists(monkeypatch):
    async def wrapped(path, params=None):
        return {"accounts": [{"id": "a1", "name": "Brokerage", "balance": 10}]}

    monkeypatch.setattr(svc, "_aget", wrapped)
    wrapped_accounts = await svc.get_accounts("u", "s")

    async def raw(path, params=None):
        return [{"id": "a2", "name": "Other", "balance": 20}]

    monkeypatch.setattr(svc, "_aget", raw)
    raw_accounts = await svc.get_accounts("u", "s")

    assert wrapped_accounts[0].id == "a1"
    assert raw_accounts[0].id == "a2"


@pytest.mark.asyncio
async def test_get_account_holdings_maps_positions(monkeypatch):
    async def fake_get(path, params=None):
        return {
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

    monkeypatch.setattr(svc, "_aget", fake_get)

    holdings = await svc.get_account_holdings("u", "s", "a1")

    assert holdings[0].gain_loss == 50
    assert holdings[0].gain_loss_percent == 25


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
