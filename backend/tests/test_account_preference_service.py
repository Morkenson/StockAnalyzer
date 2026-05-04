import pytest

from services import account_preference_service as svc


@pytest.fixture(autouse=True)
def use_memory_preferences(monkeypatch):
    monkeypatch.setattr(svc, "_use_database", False)
    svc._preferences.clear()
    yield
    svc._preferences.clear()


@pytest.mark.asyncio
async def test_update_and_get_preference():
    await svc.update_preference("user1", "acc1", nickname=" Trading ", hidden=False)

    preferences = await svc.get_preferences("user1")

    assert preferences["acc1"] == {"nickname": "Trading", "hidden": False}


@pytest.mark.asyncio
async def test_hide_account_sets_hidden():
    await svc.hide_account("user1", "acc1")

    preferences = await svc.get_preferences("user1")

    assert preferences["acc1"]["hidden"] is True


@pytest.mark.asyncio
async def test_empty_nickname_clears_nickname():
    await svc.update_preference("user1", "acc1", nickname="Trading")
    await svc.update_preference("user1", "acc1", nickname="")

    preferences = await svc.get_preferences("user1")

    assert preferences["acc1"]["nickname"] is None
