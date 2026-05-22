import pytest

from services import dividend_preference_service as svc


@pytest.fixture(autouse=True)
def use_memory_preferences(monkeypatch):
    monkeypatch.setattr(svc, "_use_database", False)
    svc._preferences.clear()
    yield
    svc._preferences.clear()


@pytest.mark.asyncio
async def test_update_and_hide_dividend_preference():
    await svc.update_preference("user1", "schd", "monthly", currency="usd")
    await svc.update_preference("user1", "schd", "monthly", currency="usd", hidden=True)

    preferences = await svc.get_preferences("user1")

    assert preferences[("SCHD", "USD")] == {
        "payment_frequency": "monthly",
        "payments_per_year": 12,
        "hidden": True,
    }
