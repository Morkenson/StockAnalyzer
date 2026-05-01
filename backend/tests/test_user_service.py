import pytest
from services import user_service


@pytest.mark.asyncio
async def test_store_and_retrieve():
    await user_service.store_user_secret("user1", "mysecret")
    assert await user_service.get_user_secret("user1") == "mysecret"


@pytest.mark.asyncio
async def test_unknown_user_returns_none():
    assert await user_service.get_user_secret("nobody") is None


@pytest.mark.asyncio
async def test_overwrite_existing_secret():
    await user_service.store_user_secret("user1", "first")
    await user_service.store_user_secret("user1", "second")
    assert await user_service.get_user_secret("user1") == "second"


@pytest.mark.asyncio
async def test_secrets_are_isolated():
    await user_service.store_user_secret("u1", "secret1")
    await user_service.store_user_secret("u2", "secret2")
    assert await user_service.get_user_secret("u1") == "secret1"
    assert await user_service.get_user_secret("u2") == "secret2"
