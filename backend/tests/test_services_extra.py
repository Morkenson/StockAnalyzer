"""Extra coverage for low-coverage preference/user services.

The conftest sets DATABASE_URL, so the services run in database mode by default
(_use_database is True) — these tests exercise the DB-backed branches that the
existing in-memory tests skip, plus a few in-memory lines that were missed.
"""
import pytest
from cryptography.fernet import Fernet

import config
from database import SessionLocal
from db_models import SnapTradeUserSecret
from services import account_preference_service
from services import dividend_preference_service
from services import recurring_preference_service
from services import user_service


# ---------------------------------------------------------------------------
# account_preference_service (DB branches: get_preferences, update_preference)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_account_pref_db_get_preferences_empty():
    assert await account_preference_service.get_preferences("nobody") == {}


@pytest.mark.asyncio
async def test_account_pref_db_create_and_get():
    result = await account_preference_service.update_preference(
        "user-db-1",
        "acc1",
        nickname="  Trading  ",
        margin_balance=1500.5,
        margin_interest_rate=7.25,
        hidden=False,
    )

    assert result == {
        "accountId": "acc1",
        "nickname": "Trading",
        "marginBalance": 1500.5,
        "marginInterestRate": 7.25,
        "hidden": False,
    }

    preferences = await account_preference_service.get_preferences("user-db-1")
    assert preferences["acc1"] == {
        "nickname": "Trading",
        "margin_balance": 1500.5,
        "margin_interest_rate": 7.25,
        "hidden": False,
    }


@pytest.mark.asyncio
async def test_account_pref_db_update_existing_row_and_clamps_negatives():
    await account_preference_service.update_preference("user-db-2", "acc1", nickname="First")
    result = await account_preference_service.update_preference(
        "user-db-2", "acc1", margin_balance=-100, margin_interest_rate=-5, hidden=True
    )

    assert result["nickname"] == "First"  # unchanged
    assert result["marginBalance"] == 0
    assert result["marginInterestRate"] == 0
    assert result["hidden"] is True


@pytest.mark.asyncio
async def test_account_pref_db_empty_nickname_clears():
    await account_preference_service.update_preference("user-db-3", "acc1", nickname="Trading")
    result = await account_preference_service.update_preference("user-db-3", "acc1", nickname="")
    assert result["nickname"] is None


@pytest.mark.asyncio
async def test_account_pref_db_hide_account():
    result = await account_preference_service.hide_account("user-db-4", "acc1")
    assert result["hidden"] is True


@pytest.mark.asyncio
async def test_account_pref_db_preferences_isolated_per_user():
    await account_preference_service.update_preference("user-a", "acc1", nickname="A")
    await account_preference_service.update_preference("user-b", "acc2", nickname="B")

    prefs_a = await account_preference_service.get_preferences("user-a")
    assert list(prefs_a) == ["acc1"]


@pytest.mark.asyncio
async def test_account_pref_memory_margin_fields(monkeypatch):
    # Covers the in-memory margin_balance / margin_interest_rate assignments.
    monkeypatch.setattr(account_preference_service, "_use_database", False)
    account_preference_service._preferences.clear()

    result = await account_preference_service.update_preference(
        "user-mem", "acc1", margin_balance=-10, margin_interest_rate=3.5
    )

    assert result["marginBalance"] == 0
    assert result["marginInterestRate"] == 3.5


# ---------------------------------------------------------------------------
# dividend_preference_service
# ---------------------------------------------------------------------------


def test_dividend_normalize_frequency_invalid_raises():
    with pytest.raises(ValueError, match="paymentFrequency must be"):
        dividend_preference_service.normalize_frequency("fortnightly")


@pytest.mark.asyncio
async def test_dividend_db_get_preferences_empty():
    assert await dividend_preference_service.get_preferences("nobody") == {}


@pytest.mark.asyncio
async def test_dividend_db_create_update_and_get():
    created = await dividend_preference_service.update_preference(
        "div-user-1", " schd ", "monthly", currency="usd"
    )
    assert created == {
        "symbol": "SCHD",
        "currency": "USD",
        "paymentFrequency": "monthly",
        "paymentsPerYear": 12.0,
        "hidden": False,
    }

    updated = await dividend_preference_service.update_preference(
        "div-user-1", "SCHD", "quarterly", currency="USD", hidden=True
    )
    assert updated["paymentFrequency"] == "quarterly"
    assert updated["paymentsPerYear"] == 4.0
    assert updated["hidden"] is True

    preferences = await dividend_preference_service.get_preferences("div-user-1")
    assert preferences[("SCHD", "USD")] == {
        "payment_frequency": "quarterly",
        "payments_per_year": 4.0,
        "hidden": True,
    }


@pytest.mark.asyncio
async def test_dividend_db_clear_specific_symbols():
    await dividend_preference_service.update_preference("div-user-2", "SCHD", "monthly")
    await dividend_preference_service.update_preference("div-user-2", "VTI", "quarterly")

    result = await dividend_preference_service.clear_preferences(
        "div-user-2", symbols=[{"symbol": "schd", "currency": "usd"}]
    )

    assert result == {"removed": 1}
    remaining = await dividend_preference_service.get_preferences("div-user-2")
    assert ("SCHD", "USD") not in remaining
    assert ("VTI", "USD") in remaining


@pytest.mark.asyncio
async def test_dividend_db_clear_all_when_no_symbols_given():
    await dividend_preference_service.update_preference("div-user-3", "SCHD", "monthly")
    await dividend_preference_service.update_preference("div-user-3", "VTI", "quarterly")

    result = await dividend_preference_service.clear_preferences("div-user-3")

    assert result == {"removed": 2}
    assert await dividend_preference_service.get_preferences("div-user-3") == {}


@pytest.mark.asyncio
async def test_dividend_db_clear_ignores_blank_symbol_entries():
    await dividend_preference_service.update_preference("div-user-4", "SCHD", "monthly")

    # Entries with blank symbols are dropped, so this clears everything for the user.
    result = await dividend_preference_service.clear_preferences(
        "div-user-4", symbols=[{"symbol": "  "}]
    )

    assert result == {"removed": 1}


@pytest.mark.asyncio
async def test_dividend_memory_clear_specific_and_all(monkeypatch):
    monkeypatch.setattr(dividend_preference_service, "_use_database", False)
    dividend_preference_service._preferences.clear()

    await dividend_preference_service.update_preference("mem-user", "SCHD", "monthly")
    await dividend_preference_service.update_preference("mem-user", "VTI", "quarterly")

    result = await dividend_preference_service.clear_preferences(
        "mem-user", symbols=[{"symbol": "SCHD", "currency": "USD"}]
    )
    assert result == {"removed": 1}

    result = await dividend_preference_service.clear_preferences("mem-user")
    assert result == {"removed": 1}
    assert await dividend_preference_service.get_preferences("mem-user") == {}


# ---------------------------------------------------------------------------
# recurring_preference_service
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_recurring_update_requires_account_id():
    with pytest.raises(ValueError, match="accountId is required"):
        await recurring_preference_service.update_preference("rec-user", "  ", "BNDI")


@pytest.mark.asyncio
async def test_recurring_update_requires_symbol():
    with pytest.raises(ValueError, match="symbol is required"):
        await recurring_preference_service.update_preference("rec-user", "acc1", "  ")


@pytest.mark.asyncio
async def test_recurring_update_rejects_negative_amount():
    with pytest.raises(ValueError, match="amount must be greater than or equal to 0"):
        await recurring_preference_service.update_preference("rec-user", "acc1", "BNDI", amount=-1)


@pytest.mark.asyncio
async def test_recurring_db_create_update_and_get():
    created = await recurring_preference_service.update_preference(
        "rec-user-1", " acc1 ", " bndi ", currency="usd", amount=25, frequency="weekly"
    )
    assert created == {
        "accountId": "acc1",
        "symbol": "BNDI",
        "currency": "USD",
        "amount": 25.0,
        "frequency": "weekly",
        "hidden": False,
    }

    updated = await recurring_preference_service.update_preference(
        "rec-user-1", "acc1", "BNDI", amount=50, frequency="monthly", hidden=True
    )
    assert updated["amount"] == 50.0
    assert updated["frequency"] == "monthly"
    assert updated["hidden"] is True

    preferences = await recurring_preference_service.get_preferences("rec-user-1")
    assert preferences[("acc1", "BNDI", "USD")] == {
        "amount": 50.0,
        "frequency": "monthly",
        "hidden": True,
    }


@pytest.mark.asyncio
async def test_recurring_db_partial_update_keeps_existing_fields():
    await recurring_preference_service.update_preference(
        "rec-user-2", "acc1", "VTI", amount=100, frequency="monthly"
    )
    updated = await recurring_preference_service.update_preference(
        "rec-user-2", "acc1", "VTI", hidden=True
    )
    assert updated["amount"] == 100.0
    assert updated["frequency"] == "monthly"
    assert updated["hidden"] is True


@pytest.mark.asyncio
async def test_recurring_clear_account_requires_account_id():
    with pytest.raises(ValueError, match="accountId is required"):
        await recurring_preference_service.clear_account_preferences("rec-user", "   ")


@pytest.mark.asyncio
async def test_recurring_db_clear_account_preferences():
    await recurring_preference_service.update_preference("rec-user-3", "acc1", "BNDI", amount=10)
    await recurring_preference_service.update_preference("rec-user-3", "acc1", "VTI", amount=20)
    await recurring_preference_service.update_preference("rec-user-3", "acc2", "VTI", amount=30)

    result = await recurring_preference_service.clear_account_preferences("rec-user-3", "acc1")

    assert result == {"accountId": "acc1", "removed": 2}
    remaining = await recurring_preference_service.get_preferences("rec-user-3")
    assert list(remaining) == [("acc2", "VTI", "USD")]


@pytest.mark.asyncio
async def test_recurring_db_clear_account_with_no_rows_returns_zero():
    result = await recurring_preference_service.clear_account_preferences("rec-user-4", "acc-none")
    assert result == {"accountId": "acc-none", "removed": 0}


# ---------------------------------------------------------------------------
# user_service (Fernet encryption / DB branches / memory branches)
# ---------------------------------------------------------------------------


def test_fernet_raises_without_encryption_key(monkeypatch):
    monkeypatch.setattr(config, "SNAPTRADE_SECRET_ENCRYPTION_KEY", "")
    with pytest.raises(RuntimeError, match="SNAPTRADE_SECRET_ENCRYPTION_KEY must be set"):
        user_service._encrypt("anything")


def test_decrypt_returns_none_for_token_from_other_key():
    foreign_token = Fernet(Fernet.generate_key()).encrypt(b"secret").decode("utf-8")
    assert user_service._decrypt(foreign_token) is None


def test_decrypt_roundtrip():
    assert user_service._decrypt(user_service._encrypt("round-trip")) == "round-trip"


@pytest.mark.asyncio
async def test_get_user_secret_db_stores_encrypted_at_rest():
    await user_service.store_user_secret("enc-user", "super-secret")
    with SessionLocal() as db:
        row = db.get(SnapTradeUserSecret, "enc-user")
        assert row is not None
        assert row.user_secret != "super-secret"
    assert await user_service.get_user_secret("enc-user") == "super-secret"


@pytest.mark.asyncio
async def test_get_user_secret_db_reencrypts_legacy_plaintext_row():
    with SessionLocal() as db:
        db.add(SnapTradeUserSecret(user_id="legacy-user", user_secret="legacy-plain"))
        db.commit()

    assert await user_service.get_user_secret("legacy-user") == "legacy-plain"

    with SessionLocal() as db:
        row = db.get(SnapTradeUserSecret, "legacy-user")
        assert row.user_secret != "legacy-plain"
        assert user_service._decrypt(row.user_secret) == "legacy-plain"

    # Subsequent reads keep returning the decrypted value.
    assert await user_service.get_user_secret("legacy-user") == "legacy-plain"


@pytest.mark.asyncio
async def test_list_user_secrets_db_returns_decrypted_and_migrates_legacy():
    await user_service.store_user_secret("list-user-1", "secret-one")
    with SessionLocal() as db:
        db.add(SnapTradeUserSecret(user_id="list-user-2", user_secret="legacy-two"))
        db.commit()

    secrets = await user_service.list_user_secrets()

    assert secrets == {"list-user-1": "secret-one", "list-user-2": "legacy-two"}
    with SessionLocal() as db:
        row = db.get(SnapTradeUserSecret, "list-user-2")
        assert row.user_secret != "legacy-two"


@pytest.mark.asyncio
async def test_list_user_secrets_db_empty():
    assert await user_service.list_user_secrets() == {}


@pytest.mark.asyncio
async def test_user_service_memory_store_get_and_list(monkeypatch):
    monkeypatch.setattr(user_service, "_use_database", False)
    user_service._user_secrets.clear()

    await user_service.store_user_secret("mem-user", "mem-secret")

    assert await user_service.get_user_secret("mem-user") == "mem-secret"
    assert await user_service.get_user_secret("missing") is None
    assert await user_service.list_user_secrets() == {"mem-user": "mem-secret"}
