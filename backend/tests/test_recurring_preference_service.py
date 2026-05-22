import pytest

from models.snaptrade_models import RecurringInvestment
from services import recurring_preference_service as svc


@pytest.fixture(autouse=True)
def use_memory_preferences(monkeypatch):
    monkeypatch.setattr(svc, "_use_database", False)
    svc._preferences.clear()
    yield
    svc._preferences.clear()


@pytest.mark.anyio
async def test_update_and_apply_recurring_preference():
    await svc.update_preference(
        "user1",
        "acc1",
        "bndi",
        amount=22,
        frequency="daily",
        currency="usd",
    )
    preferences = await svc.get_preferences("user1")
    recurring = [
        RecurringInvestment(
            account_id="acc1",
            account_name="Trading",
            symbol="BNDI",
            amount=20,
            currency="USD",
            frequency="weekly",
        )
    ]

    adjusted = svc.apply_preferences(recurring, preferences)

    assert adjusted[0].amount == 22
    assert adjusted[0].frequency == "daily"
    assert adjusted[0].source == "manual"
    assert recurring[0].amount == 20


@pytest.mark.anyio
async def test_hidden_recurring_preference_removes_row():
    await svc.update_preference("user1", "acc1", "BNDI", hidden=True)
    preferences = await svc.get_preferences("user1")
    recurring = [
        RecurringInvestment(
            account_id="acc1",
            account_name="Trading",
            symbol="BNDI",
            amount=22,
            currency="USD",
            frequency="daily",
        )
    ]

    assert svc.apply_preferences(recurring, preferences) == []


@pytest.mark.anyio
async def test_clear_account_preferences_removes_only_that_account():
    await svc.update_preference("user1", "acc1", "BNDI", amount=22, frequency="daily")
    await svc.update_preference("user1", "acc2", "VTI", amount=50, frequency="weekly")

    result = await svc.clear_account_preferences("user1", "acc1")
    preferences = await svc.get_preferences("user1")

    assert result == {"accountId": "acc1", "removed": 1}
    assert ("acc1", "BNDI", "USD") not in preferences
    assert ("acc2", "VTI", "USD") in preferences


@pytest.mark.anyio
async def test_invalid_recurring_frequency_is_rejected():
    with pytest.raises(ValueError):
        await svc.update_preference("user1", "acc1", "BNDI", frequency="whenever")
