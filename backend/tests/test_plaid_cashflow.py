from datetime import date
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete as sql_delete, select

from database import SessionLocal, init_db
from db_models import AppUser, CashflowEntry, PlaidAccount, PlaidItem
from main import app
from routers.persistence import _current_user
from services import plaid_service


def _user() -> AppUser:
    return AppUser(id=str(uuid4()), email=f"user-{uuid4()}@example.com", password_hash="fake")


def _client_for(user: AppUser) -> TestClient:
    user_id = user.id
    user_email = user.email
    init_db()
    with SessionLocal() as db:
        db.add(user)
        db.commit()
    app.dependency_overrides[_current_user] = lambda: AppUser(id=user_id, email=user_email, password_hash="fake")
    return TestClient(app)


def _cleanup(user_id: str) -> None:
    app.dependency_overrides.pop(_current_user, None)
    with SessionLocal() as db:
        db.execute(sql_delete(CashflowEntry).where(CashflowEntry.user_id == user_id))
        db.execute(sql_delete(PlaidAccount).where(PlaidAccount.user_id == user_id))
        db.execute(sql_delete(PlaidItem).where(PlaidItem.user_id == user_id))
        db.execute(sql_delete(AppUser).where(AppUser.id == user_id))
        db.commit()


def test_cashflow_crud_requires_auth(client):
    response = client.get("/api/cashflow/entries?month=2026-05")

    assert response.status_code == 401


def test_manual_cashflow_crud():
    user = _user()
    user_id = user.id
    client = _client_for(user)
    try:
        create = client.post(
            "/api/cashflow/entries",
            json={"type": "expense", "name": "Internet", "category": "Bills", "amount": 80, "date": "2026-05-03"},
        )
        assert create.status_code == 201
        entry_id = create.json()["data"]["id"]

        list_response = client.get("/api/cashflow/entries?month=2026-05")
        assert list_response.status_code == 200
        assert list_response.json()["data"][0]["name"] == "Internet"

        patch_response = client.patch(entry_path(entry_id), json={"amount": 85})
        assert patch_response.status_code == 200
        assert patch_response.json()["data"]["amount"] == 85

        delete_response = client.delete(entry_path(entry_id))
        assert delete_response.status_code == 200
        assert client.get("/api/cashflow/entries?month=2026-05").json()["data"] == []
    finally:
        _cleanup(user_id)


def entry_path(entry_id: str) -> str:
    return f"/api/cashflow/entries/{entry_id}"


def test_plaid_router_link_exchange_accounts_and_sync():
    user = _user()
    user_id = user.id
    client = _client_for(user)
    try:
        with patch("services.plaid_service.create_link_token", new=AsyncMock(return_value="link-token")):
            link = client.post("/api/plaid/link-token")
        assert link.status_code == 200
        assert link.json()["data"]["linkToken"] == "link-token"

        with patch(
            "services.plaid_service.exchange_public_token",
            new=AsyncMock(return_value={"itemId": "item-1", "sync": {"added": 1, "modified": 0, "removed": 0}}),
        ) as exchange:
            response = client.post(
                "/api/plaid/exchange-public-token",
                json={"publicToken": "public-token", "institutionName": "Test Bank"},
            )
        assert response.status_code == 200
        exchange.assert_awaited_once()

        with patch(
            "services.plaid_service.sync_user_items",
            new=AsyncMock(return_value={"added": 0, "modified": 0, "removed": 0, "itemsSynced": 1, "skipped": False}),
        ):
            sync = client.post("/api/plaid/sync", json={"auto": False})
        assert sync.status_code == 200
        assert sync.json()["data"]["itemsSynced"] == 1

        accounts = client.get("/api/plaid/accounts")
        assert accounts.status_code == 200
        assert accounts.json()["data"] == []
    finally:
        _cleanup(user_id)


def test_disconnect_plaid_account_removes_item_and_hides_imported_entries():
    user = _user()
    user_id = user.id
    client = _client_for(user)
    try:
        with SessionLocal() as db:
            item = PlaidItem(
                user_id=user_id,
                plaid_item_id="plaid-item-1",
                access_token_encrypted=plaid_service.encrypt_access_token("access-token"),
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            account = PlaidAccount(
                user_id=user_id,
                item_id=item.id,
                plaid_account_id="card-1",
                name="Visa",
                type="credit",
                subtype="credit card",
            )
            entry = CashflowEntry(
                user_id=user_id,
                source="plaid",
                type="expense",
                name="Coffee",
                category="Food",
                amount=6.50,
                date=date(2026, 5, 2),
                plaid_account_id="card-1",
                plaid_transaction_id="tx-1",
            )
            db.add_all([account, entry])
            db.commit()
            db.refresh(account)
            account_id = account.id

        with patch("services.plaid_service.remove_item", new=AsyncMock()) as remove_item:
            response = client.delete(f"/api/plaid/accounts/{account_id}")

        assert response.status_code == 200
        remove_item.assert_awaited_once_with("access-token")
        assert response.json()["data"]["removedAccounts"] == 1
        assert response.json()["data"]["removedEntries"] == 1
        assert client.get("/api/plaid/accounts").json()["data"] == []
        assert client.get("/api/cashflow/entries?month=2026-05").json()["data"] == []
        with SessionLocal() as db:
            assert db.scalar(select(PlaidItem).where(PlaidItem.user_id == user_id)) is None
    finally:
        _cleanup(user_id)


def test_disconnect_plaid_account_returns_plaid_error_without_local_delete():
    user = _user()
    user_id = user.id
    client = _client_for(user)
    try:
        with SessionLocal() as db:
            item = PlaidItem(
                user_id=user_id,
                plaid_item_id="plaid-item-1",
                access_token_encrypted=plaid_service.encrypt_access_token("access-token"),
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            account = PlaidAccount(
                user_id=user_id,
                item_id=item.id,
                plaid_account_id="card-1",
                name="Visa",
                type="credit",
                subtype="credit card",
            )
            db.add(account)
            db.commit()
            db.refresh(account)
            account_id = account.id

        with patch(
            "services.plaid_service.remove_item",
            new=AsyncMock(side_effect=plaid_service.PlaidServiceError("invalid client_id or secret provided", status_code=400)),
        ):
            response = client.delete(f"/api/plaid/accounts/{account_id}")

        assert response.status_code == 400
        assert response.json()["message"] == "invalid client_id or secret provided"
        with SessionLocal() as db:
            assert db.scalar(select(PlaidItem).where(PlaidItem.user_id == user_id)) is not None
            assert db.scalar(select(PlaidAccount).where(PlaidAccount.user_id == user_id)).hidden is False
    finally:
        _cleanup(user_id)


def test_hide_plaid_account_keeps_item_and_only_hides_that_account_entries():
    user = _user()
    user_id = user.id
    client = _client_for(user)
    try:
        with SessionLocal() as db:
            item = PlaidItem(
                user_id=user_id,
                plaid_item_id="plaid-item-1",
                access_token_encrypted=plaid_service.encrypt_access_token("access-token"),
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            hidden_account = PlaidAccount(
                user_id=user_id,
                item_id=item.id,
                plaid_account_id="card-1",
                name="Visa",
                type="credit",
                subtype="credit card",
            )
            visible_account = PlaidAccount(
                user_id=user_id,
                item_id=item.id,
                plaid_account_id="checking-1",
                name="Checking",
                type="depository",
                subtype="checking",
            )
            hidden_entry = CashflowEntry(
                user_id=user_id,
                source="plaid",
                type="expense",
                name="Coffee",
                category="Food",
                amount=6.50,
                date=date(2026, 5, 2),
                plaid_account_id="card-1",
                plaid_transaction_id="tx-card",
            )
            visible_entry = CashflowEntry(
                user_id=user_id,
                source="plaid",
                type="income",
                name="Payroll",
                category="Income",
                amount=2500,
                date=date(2026, 5, 3),
                plaid_account_id="checking-1",
                plaid_transaction_id="tx-checking",
            )
            db.add_all([hidden_account, visible_account, hidden_entry, visible_entry])
            db.commit()
            db.refresh(hidden_account)
            account_id = hidden_account.id

        with patch("services.plaid_service.remove_item", new=AsyncMock()) as remove_item:
            response = client.patch(f"/api/plaid/accounts/{account_id}/hide", json={})

        assert response.status_code == 200
        remove_item.assert_not_awaited()
        assert response.json()["data"]["hidden"] is True
        assert response.json()["data"]["removedEntries"] == 1
        accounts = client.get("/api/plaid/accounts").json()["data"]
        assert [account["name"] for account in accounts] == ["Checking"]
        entries = client.get("/api/cashflow/entries?month=2026-05").json()["data"]
        assert [entry["name"] for entry in entries] == ["Payroll"]
        with SessionLocal() as db:
            assert db.scalar(select(PlaidItem).where(PlaidItem.user_id == user_id)) is not None
            assert db.scalar(select(PlaidAccount).where(PlaidAccount.id == account_id)).hidden is True
    finally:
        _cleanup(user_id)


def test_plaid_sync_imports_posted_transactions_and_protects_duplicates():
    user = _user()
    user_id = user.id
    init_db()
    try:
        with SessionLocal() as db:
            db.add(user)
            item = PlaidItem(
                user_id=user.id,
                plaid_item_id="plaid-item-1",
                access_token_encrypted=plaid_service.encrypt_access_token("access-token"),
            )
            db.add(item)
            db.commit()
            db.refresh(item)

            responses = [
                {
                    "accounts": [
                        {
                            "account_id": "card-1",
                            "name": "Visa",
                            "type": "credit",
                            "subtype": "credit card",
                            "balances": {"current": 123.45, "available": 500, "iso_currency_code": "USD"},
                        },
                        {
                            "account_id": "checking-1",
                            "name": "Checking",
                            "type": "depository",
                            "subtype": "checking",
                            "balances": {"current": 2500, "available": 2400, "iso_currency_code": "USD"},
                        }
                    ]
                },
                {
                    "added": [
                        {
                            "transaction_id": "tx-expense",
                            "account_id": "card-1",
                            "item_id": "plaid-item-1",
                            "name": "Coffee",
                            "merchant_name": "Coffee Shop",
                            "amount": 6.5,
                            "date": "2026-05-02",
                            "pending": False,
                            "personal_finance_category": {"primary": "FOOD_AND_DRINK"},
                        },
                        {
                            "transaction_id": "tx-pending",
                            "account_id": "card-1",
                            "item_id": "plaid-item-1",
                            "name": "Pending",
                            "amount": 12,
                            "date": "2026-05-02",
                            "pending": True,
                        },
                        {
                            "transaction_id": "tx-income",
                            "account_id": "card-1",
                            "item_id": "plaid-item-1",
                            "name": "Refund",
                            "amount": -20,
                            "date": "2026-05-03",
                            "pending": False,
                        },
                        {
                            "transaction_id": "tx-payment",
                            "account_id": "card-1",
                            "item_id": "plaid-item-1",
                            "name": "Payment - Bilt Housing",
                            "amount": -390,
                            "date": "2026-05-03",
                            "pending": False,
                            "personal_finance_category": {"primary": "INCOME", "detailed": "TRANSFER_IN_ACCOUNT_TRANSFER"},
                        },
                        {
                            "transaction_id": "tx-bilt-rent",
                            "account_id": "card-1",
                            "item_id": "plaid-item-1",
                            "name": "Bilt Housing Payment",
                            "amount": 390,
                            "date": "2026-05-03",
                            "pending": False,
                            "personal_finance_category": {"primary": "RENT_AND_UTILITIES"},
                        },
                        {
                            "transaction_id": "tx-checking-income",
                            "account_id": "checking-1",
                            "item_id": "plaid-item-1",
                            "name": "Payroll",
                            "amount": -2500,
                            "date": "2026-05-04",
                            "pending": False,
                            "personal_finance_category": {"primary": "INCOME"},
                        },
                        {
                            "transaction_id": "tx-checking-card-payment",
                            "account_id": "checking-1",
                            "item_id": "plaid-item-1",
                            "name": "Credit Card Payment",
                            "amount": 390,
                            "date": "2026-05-04",
                            "pending": False,
                            "personal_finance_category": {"primary": "LOAN_PAYMENTS"},
                        },
                    ],
                    "modified": [],
                    "removed": [],
                    "next_cursor": "cursor-1",
                    "has_more": False,
                },
            ]
            with patch("services.plaid_service._plaid_post", new=AsyncMock(side_effect=responses)):
                summary = run_sync(db, item)

            assert summary == {"added": 4, "modified": 0, "removed": 0}
            entries = db.scalars(select(CashflowEntry).where(CashflowEntry.user_id == user.id)).all()
            assert len(entries) == 4
            assert {entry.type for entry in entries} == {"expense", "income"}
            assert {entry.plaid_transaction_id for entry in entries} == {"tx-expense", "tx-income", "tx-bilt-rent", "tx-checking-income"}
            account = db.scalar(select(PlaidAccount).where(PlaidAccount.user_id == user.id))
            assert float(account.current_balance) == 123.45
    finally:
        _cleanup(user_id)


def run_sync(db, item):
    import asyncio

    return asyncio.run(plaid_service.sync_item(db, item))
