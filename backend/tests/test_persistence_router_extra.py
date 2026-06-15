"""Extra coverage for routers/persistence.py: watchlists, loan/asset updates, auth edge cases."""
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from sqlalchemy import delete as sql_delete, select

from database import SessionLocal
from db_models import AppUser, PasswordResetToken
from routers import persistence

PASSWORD = "very-secure-pass"


def _email() -> str:
    return f"user-{uuid4()}@example.com"


def _signup_pending(client, email: str, password: str = PASSWORD) -> tuple[str, str]:
    """Sign up and return (pendingUserId, otp_code) without verifying."""
    last_code: list[str] = []

    async def capture(to_email: str, code: str) -> None:
        last_code.append(code)

    with patch("services.email_service.send_otp_email", new=AsyncMock(side_effect=capture)):
        resp = client.post("/api/auth/signup", json={"email": email, "password": password})

    assert resp.status_code == 201
    return resp.json()["data"]["pendingUserId"], last_code[0]


def _signup_and_login(client, email: str | None = None, password: str = PASSWORD) -> str:
    """Sign up, verify OTP, clear cookies, and return a bearer token."""
    pending_user_id, code = _signup_pending(client, email or _email(), password)
    verify = client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": code})
    assert verify.status_code == 200
    client.cookies.clear()
    return verify.json()["data"]["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _wrong_code(code: str) -> str:
    return "000000" if code != "000000" else "111111"


# ---------------------------------------------------------------------------
# Auth edge cases
# ---------------------------------------------------------------------------


def test_signup_rejects_short_password(client):
    resp = client.post("/api/auth/signup", json={"email": _email(), "password": "short"})
    assert resp.status_code == 400
    assert "12 characters" in resp.json()["detail"]


def test_signup_duplicate_email_conflict(client):
    email = _email()
    _signup_pending(client, email)
    with patch("services.email_service.send_otp_email", new=AsyncMock()):
        resp = client.post("/api/auth/signup", json={"email": email, "password": PASSWORD})
    assert resp.status_code == 409


def test_signin_wrong_password_rejected(client):
    email = _email()
    _signup_pending(client, email)
    resp = client.post("/api/auth/signin", json={"email": email, "password": "wrong-password-here"})
    assert resp.status_code == 401


def test_signin_unknown_email_rejected(client):
    resp = client.post("/api/auth/signin", json={"email": _email(), "password": PASSWORD})
    assert resp.status_code == 401


def test_verify_otp_wrong_code_then_correct_code(client):
    pending_user_id, code = _signup_pending(client, _email())

    bad = client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": _wrong_code(code)})
    assert bad.status_code == 400
    assert bad.json()["detail"] == "Invalid code"

    good = client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": code})
    assert good.status_code == 200


def test_verify_otp_locks_out_after_max_attempts(client):
    pending_user_id, code = _signup_pending(client, _email())
    wrong = _wrong_code(code)

    for attempt in range(persistence.OTP_MAX_ATTEMPTS):
        resp = client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": wrong})
        assert resp.status_code == 400

    # Final wrong attempt should announce the lockout
    assert resp.json()["detail"] == "Too many incorrect attempts. Please sign in again."

    # Even the correct code is rejected once locked out
    locked = client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": code})
    assert locked.status_code == 400
    assert locked.json()["detail"] == "Invalid or expired code"


def test_verify_otp_unknown_pending_user(client):
    resp = client.post("/api/auth/verify-otp", json={"pendingUserId": str(uuid4()), "code": "123456"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid or expired code"


def test_resend_otp_unknown_pending_user_sends_nothing(client):
    with patch("services.email_service.send_otp_email", new=AsyncMock()) as send_otp:
        resp = client.post("/api/auth/resend-otp", json={"pendingUserId": str(uuid4())})
    assert resp.status_code == 200
    send_otp.assert_not_called()


def test_resend_otp_replaces_previous_code(client):
    pending_user_id, old_code = _signup_pending(client, _email())

    new_codes: list[str] = []

    async def capture(to_email: str, code: str) -> None:
        new_codes.append(code)

    with patch("services.email_service.send_otp_email", new=AsyncMock(side_effect=capture)):
        resend = client.post("/api/auth/resend-otp", json={"pendingUserId": pending_user_id})
    assert resend.status_code == 200
    assert len(new_codes) == 1

    # Old code is invalidated; only the new one verifies
    old = client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": old_code})
    if old_code != new_codes[0]:
        assert old.status_code == 400
    fresh = client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": new_codes[0]})
    assert fresh.status_code == 200


def test_resend_otp_rate_limited(client):
    # Pre-populate the bucket with stale entries to also exercise window pruning
    persistence._rate_buckets["resend-otp:testclient"].extend([time.time() - 3600] * 2)

    with patch("services.email_service.send_otp_email", new=AsyncMock()):
        for _ in range(3):
            resp = client.post("/api/auth/resend-otp", json={"pendingUserId": str(uuid4())})
            assert resp.status_code == 200
        limited = client.post("/api/auth/resend-otp", json={"pendingUserId": str(uuid4())})
    assert limited.status_code == 429


def test_me_requires_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_rejects_garbage_token(client):
    resp = client.get("/api/auth/me", headers=_auth("not-a-jwt-at-all"))
    assert resp.status_code == 401


def test_me_rejects_tampered_token(client):
    token = _signup_and_login(client)
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
    resp = client.get("/api/auth/me", headers=_auth(tampered))
    assert resp.status_code == 401


def test_me_rejects_token_of_deleted_user(client):
    email = _email()
    token = _signup_and_login(client, email)

    with SessionLocal() as db:
        db.execute(sql_delete(AppUser).where(AppUser.email == email))
        db.commit()

    resp = client.get("/api/auth/me", headers=_auth(token))
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid session"


def test_signout_invalidates_existing_tokens(client):
    token = _signup_and_login(client)
    assert client.get("/api/auth/me", headers=_auth(token)).status_code == 200

    signout = client.post("/api/auth/signout", headers=_auth(token))
    assert signout.status_code == 200

    # token_version was bumped, so the old token is revoked
    resp = client.get("/api/auth/me", headers=_auth(token))
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Session revoked"


def test_signout_without_session_still_succeeds(client):
    resp = client.post("/api/auth/signout")
    assert resp.status_code == 200
    assert resp.json()["success"] is True


# ---------------------------------------------------------------------------
# Password reset edge cases
# ---------------------------------------------------------------------------


def test_reset_password_rejects_short_password(client):
    resp = client.post("/api/auth/reset-password", json={"token": "whatever", "password": "short"})
    assert resp.status_code == 400
    assert "12 characters" in resp.json()["detail"]


def test_reset_password_rejects_unknown_token(client):
    resp = client.post("/api/auth/reset-password", json={"token": "bogus-token", "password": "new-secure-pass"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid or expired reset token"


def test_reset_password_rejects_expired_token(client):
    email = _email()
    _signup_pending(client, email)
    reset = client.post("/api/auth/request-password-reset", json={"email": email})
    token = reset.json()["data"]["resetToken"]

    with SessionLocal() as db:
        user = db.scalar(select(AppUser).where(AppUser.email == email))
        row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == str(user.id)))
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()

    resp = client.post("/api/auth/reset-password", json={"token": token, "password": "new-secure-pass"})
    assert resp.status_code == 400


def test_reset_password_rejects_reused_token(client):
    email = _email()
    _signup_pending(client, email)
    reset = client.post("/api/auth/request-password-reset", json={"email": email})
    token = reset.json()["data"]["resetToken"]

    first = client.post("/api/auth/reset-password", json={"token": token, "password": "new-secure-pass"})
    assert first.status_code == 200

    second = client.post("/api/auth/reset-password", json={"token": token, "password": "another-secure-pass"})
    assert second.status_code == 400


def test_reset_password_rejects_token_for_deleted_user(client):
    email = _email()
    _signup_pending(client, email)
    reset = client.post("/api/auth/request-password-reset", json={"email": email})
    token = reset.json()["data"]["resetToken"]

    # Remove the user but leave the token row (SQLite does not enforce the FK cascade here)
    with SessionLocal() as db:
        db.execute(sql_delete(AppUser).where(AppUser.email == email))
        db.commit()

    resp = client.post("/api/auth/reset-password", json={"token": token, "password": "new-secure-pass"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid reset token"


# ---------------------------------------------------------------------------
# Loans: update / delete
# ---------------------------------------------------------------------------

LOAN_PAYLOAD = {
    "name": "Car",
    "principal": 12000,
    "interestRate": 6.5,
    "loanTerm": 48,
    "monthlyPayment": 284.55,
    "totalAmountPaid": 13658.4,
    "totalInterest": 1658.4,
}


def _create_loan(client, token: str) -> str:
    resp = client.post("/api/loans", json=LOAN_PAYLOAD, headers=_auth(token))
    assert resp.status_code == 201
    return resp.json()["data"]["id"]


def test_update_loan_changes_fields_and_strips_strings(client):
    token = _signup_and_login(client)
    loan_id = _create_loan(client, token)

    resp = client.patch(
        f"/api/loans/{loan_id}",
        json={"name": "  Truck  ", "principal": 9999.5, "notes": " refinanced "},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "Truck"
    assert data["principal"] == 9999.5
    assert data["notes"] == "refinanced"
    assert data["loanTerm"] == 48  # untouched field preserved


def test_update_loan_missing_id_returns_404(client):
    token = _signup_and_login(client)
    resp = client.patch(f"/api/loans/{uuid4()}", json={"name": "X"}, headers=_auth(token))
    assert resp.status_code == 404


def test_update_loan_of_other_user_returns_404(client):
    owner = _signup_and_login(client)
    loan_id = _create_loan(client, owner)
    intruder = _signup_and_login(client)

    resp = client.patch(f"/api/loans/{loan_id}", json={"name": "Hijacked"}, headers=_auth(intruder))
    assert resp.status_code == 404


def test_delete_loan_removes_it(client):
    token = _signup_and_login(client)
    loan_id = _create_loan(client, token)

    resp = client.delete(f"/api/loans/{loan_id}", headers=_auth(token))
    assert resp.status_code == 200

    loans = client.get("/api/loans", headers=_auth(token))
    assert loans.json()["data"] == []


def test_delete_loan_missing_id_returns_404(client):
    token = _signup_and_login(client)
    resp = client.delete(f"/api/loans/{uuid4()}", headers=_auth(token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Assets: create validation, update, delete
# ---------------------------------------------------------------------------

ASSET_PAYLOAD = {"name": "Emergency Fund", "assetType": "Cash", "value": 15000, "institution": "Local Bank"}


def _create_asset(client, token: str) -> str:
    resp = client.post("/api/assets", json=ASSET_PAYLOAD, headers=_auth(token))
    assert resp.status_code == 201
    return resp.json()["data"]["id"]


def test_create_asset_rejects_negative_value(client):
    token = _signup_and_login(client)
    resp = client.post("/api/assets", json={**ASSET_PAYLOAD, "value": -1}, headers=_auth(token))
    assert resp.status_code == 400


def test_create_asset_rejects_blank_name_and_type(client):
    token = _signup_and_login(client)
    no_name = client.post("/api/assets", json={**ASSET_PAYLOAD, "name": "   "}, headers=_auth(token))
    assert no_name.status_code == 400
    no_type = client.post("/api/assets", json={**ASSET_PAYLOAD, "assetType": "   "}, headers=_auth(token))
    assert no_type.status_code == 400


def test_update_asset_changes_fields(client):
    token = _signup_and_login(client)
    asset_id = _create_asset(client, token)

    resp = client.patch(
        f"/api/assets/{asset_id}",
        json={"name": " Brokerage ", "value": 20000, "notes": "rebalanced"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "Brokerage"
    assert data["value"] == 20000
    assert data["notes"] == "rebalanced"
    assert data["assetType"] == "Cash"


def test_update_asset_rejects_negative_value(client):
    token = _signup_and_login(client)
    asset_id = _create_asset(client, token)
    resp = client.patch(f"/api/assets/{asset_id}", json={"value": -50}, headers=_auth(token))
    assert resp.status_code == 400


def test_update_asset_rejects_blank_name_and_type(client):
    token = _signup_and_login(client)
    asset_id = _create_asset(client, token)
    no_name = client.patch(f"/api/assets/{asset_id}", json={"name": "  "}, headers=_auth(token))
    assert no_name.status_code == 400
    no_type = client.patch(f"/api/assets/{asset_id}", json={"assetType": "  "}, headers=_auth(token))
    assert no_type.status_code == 400


def test_update_asset_missing_id_returns_404(client):
    token = _signup_and_login(client)
    resp = client.patch(f"/api/assets/{uuid4()}", json={"value": 1}, headers=_auth(token))
    assert resp.status_code == 404


def test_delete_asset_removes_it(client):
    token = _signup_and_login(client)
    asset_id = _create_asset(client, token)

    resp = client.delete(f"/api/assets/{asset_id}", headers=_auth(token))
    assert resp.status_code == 200

    assets = client.get("/api/assets", headers=_auth(token))
    assert assets.json()["data"] == []


def test_delete_asset_of_other_user_returns_404(client):
    owner = _signup_and_login(client)
    asset_id = _create_asset(client, owner)
    intruder = _signup_and_login(client)

    resp = client.delete(f"/api/assets/{asset_id}", headers=_auth(intruder))
    assert resp.status_code == 404

    # Asset is still there for its owner
    assets = client.get("/api/assets", headers=_auth(owner))
    assert len(assets.json()["data"]) == 1


# ---------------------------------------------------------------------------
# Watchlists CRUD
# ---------------------------------------------------------------------------


def _create_watchlist(client, token: str, name: str = "Tech", **extra) -> str:
    resp = client.post("/api/watchlists", json={"name": name, **extra}, headers=_auth(token))
    assert resp.status_code == 201
    return resp.json()["data"]["id"]


def test_create_and_list_watchlists_orders_default_first(client):
    token = _signup_and_login(client)
    _create_watchlist(client, token, name="Growth")
    default_id = _create_watchlist(client, token, name="Core", is_default=True, description=" main list ")

    resp = client.get("/api/watchlists", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2
    assert data[0]["id"] == default_id
    assert data[0]["isDefault"] is True
    assert data[0]["description"] == "main list"


def test_create_default_watchlist_clears_previous_default(client):
    token = _signup_and_login(client)
    first = _create_watchlist(client, token, name="First", is_default=True)
    second = _create_watchlist(client, token, name="Second", is_default=True)

    data = client.get("/api/watchlists", headers=_auth(token)).json()["data"]
    flags = {row["id"]: row["isDefault"] for row in data}
    assert flags[second] is True
    assert flags[first] is False


def test_rename_watchlist(client):
    token = _signup_and_login(client)
    watchlist_id = _create_watchlist(client, token, name="Old Name")

    resp = client.patch(
        f"/api/watchlists/{watchlist_id}",
        json={"name": "  New Name ", "description": "renamed"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "New Name"
    assert resp.json()["data"]["description"] == "renamed"


def test_update_watchlist_set_default_clears_others(client):
    token = _signup_and_login(client)
    first = _create_watchlist(client, token, name="First", is_default=True)
    second = _create_watchlist(client, token, name="Second")

    resp = client.patch(f"/api/watchlists/{second}", json={"isDefault": True}, headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["data"]["isDefault"] is True

    data = client.get("/api/watchlists", headers=_auth(token)).json()["data"]
    flags = {row["id"]: row["isDefault"] for row in data}
    assert flags[first] is False
    assert flags[second] is True


def test_update_watchlist_missing_id_returns_404(client):
    token = _signup_and_login(client)
    resp = client.patch(f"/api/watchlists/{uuid4()}", json={"name": "X"}, headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Watchlist not found"


def test_update_watchlist_of_other_user_returns_404(client):
    owner = _signup_and_login(client)
    watchlist_id = _create_watchlist(client, owner)
    intruder = _signup_and_login(client)

    resp = client.patch(f"/api/watchlists/{watchlist_id}", json={"name": "Mine now"}, headers=_auth(intruder))
    assert resp.status_code == 404


def test_delete_watchlist_removes_it(client):
    token = _signup_and_login(client)
    watchlist_id = _create_watchlist(client, token)

    resp = client.delete(f"/api/watchlists/{watchlist_id}", headers=_auth(token))
    assert resp.status_code == 200
    assert client.get("/api/watchlists", headers=_auth(token)).json()["data"] == []


def test_delete_watchlist_missing_id_returns_404(client):
    token = _signup_and_login(client)
    resp = client.delete(f"/api/watchlists/{uuid4()}", headers=_auth(token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Watchlist items
# ---------------------------------------------------------------------------


def test_watchlist_items_add_list_delete(client):
    token = _signup_and_login(client)
    watchlist_id = _create_watchlist(client, token)

    added = client.post(
        f"/api/watchlists/{watchlist_id}/items",
        json={"symbol": " aapl ", "notes": " long term "},
        headers=_auth(token),
    )
    assert added.status_code == 201

    items = client.get(f"/api/watchlists/{watchlist_id}/items", headers=_auth(token)).json()["data"]
    assert len(items) == 1
    assert items[0]["symbol"] == "AAPL"  # stripped and uppercased
    assert items[0]["notes"] == "long term"

    deleted = client.delete(f"/api/watchlists/{watchlist_id}/items/aapl", headers=_auth(token))
    assert deleted.status_code == 200
    assert client.get(f"/api/watchlists/{watchlist_id}/items", headers=_auth(token)).json()["data"] == []


def test_watchlist_duplicate_item_is_ignored(client):
    token = _signup_and_login(client)
    watchlist_id = _create_watchlist(client, token)

    first = client.post(f"/api/watchlists/{watchlist_id}/items", json={"symbol": "MSFT"}, headers=_auth(token))
    dup = client.post(f"/api/watchlists/{watchlist_id}/items", json={"symbol": "msft"}, headers=_auth(token))
    assert first.status_code == 201
    assert dup.status_code == 201  # IntegrityError swallowed

    items = client.get(f"/api/watchlists/{watchlist_id}/items", headers=_auth(token)).json()["data"]
    assert len(items) == 1


def test_delete_missing_watchlist_item_is_noop(client):
    token = _signup_and_login(client)
    watchlist_id = _create_watchlist(client, token)

    resp = client.delete(f"/api/watchlists/{watchlist_id}/items/NVDA", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_watchlist_items_404_for_missing_watchlist(client):
    token = _signup_and_login(client)
    missing = uuid4()
    assert client.get(f"/api/watchlists/{missing}/items", headers=_auth(token)).status_code == 404
    assert (
        client.post(f"/api/watchlists/{missing}/items", json={"symbol": "AAPL"}, headers=_auth(token)).status_code
        == 404
    )
    assert client.delete(f"/api/watchlists/{missing}/items/AAPL", headers=_auth(token)).status_code == 404


def test_watchlist_items_404_for_other_users_watchlist(client):
    owner = _signup_and_login(client)
    watchlist_id = _create_watchlist(client, owner)
    client.post(f"/api/watchlists/{watchlist_id}/items", json={"symbol": "AAPL"}, headers=_auth(owner))
    intruder = _signup_and_login(client)

    assert client.get(f"/api/watchlists/{watchlist_id}/items", headers=_auth(intruder)).status_code == 404
    assert (
        client.post(
            f"/api/watchlists/{watchlist_id}/items", json={"symbol": "TSLA"}, headers=_auth(intruder)
        ).status_code
        == 404
    )
    assert client.delete(f"/api/watchlists/{watchlist_id}/items/AAPL", headers=_auth(intruder)).status_code == 404


# ---------------------------------------------------------------------------
# Small helper-level checks
# ---------------------------------------------------------------------------


def test_verify_password_supports_legacy_and_rejects_malformed():
    legacy = persistence._hash_password("pw", iterations=120_000).replace("pbkdf2_sha256_120000$", "pbkdf2_sha256$", 1)
    assert persistence._verify_password("pw", legacy)
    assert not persistence._verify_password("nope", legacy)
    assert not persistence._verify_password("pw", "garbage-without-separators")
    assert not persistence._verify_password("pw", "unknown_algo$c2FsdA==$ZGlnZXN0")


def test_as_utc_converts_aware_datetimes():
    eastern = timezone(timedelta(hours=-5))
    aware = datetime(2026, 1, 1, 7, 0, tzinfo=eastern)
    assert persistence._as_utc(aware) == datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    assert persistence._as_utc(None) is None
