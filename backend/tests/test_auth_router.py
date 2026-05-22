from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from sqlalchemy import select

from database import SessionLocal
from db_models import AppUser


def _email() -> str:
    return f"user-{uuid4()}@example.com"


def _signup_and_login(client, email: str, password: str = "very-secure-pass") -> None:
    """Sign up and complete OTP verification so the client has an auth cookie."""
    last_code: list[str] = []

    async def capture(to_email: str, code: str) -> None:
        last_code.append(code)

    with patch("services.email_service.send_otp_email", new=AsyncMock(side_effect=capture)):
        resp = client.post("/api/auth/signup", json={"email": email, "password": password})

    assert resp.status_code == 201
    pending_user_id = resp.json()["data"]["pendingUserId"]
    client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": last_code[0]})


def test_signup_requires_otp_then_cookie_and_me_returns_user(client):
    email = _email()
    last_code: list[str] = []

    async def capture(to_email: str, code: str) -> None:
        last_code.append(code)

    with patch("services.email_service.send_otp_email", new=AsyncMock(side_effect=capture)):
        signup = client.post("/api/auth/signup", json={"email": email, "password": "very-secure-pass"})

    assert signup.status_code == 201
    assert signup.json()["data"]["pendingUserId"]
    assert "set-cookie" not in signup.headers

    pending_user_id = signup.json()["data"]["pendingUserId"]
    verify = client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": last_code[0]})
    assert verify.status_code == 200
    assert verify.json()["data"]["user"]["email"] == email
    assert "access_token=" in verify.headers["set-cookie"]
    assert "HttpOnly" in verify.headers["set-cookie"]

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["data"]["user"]["email"] == email


def test_verify_otp_records_four_hour_trust_window(client):
    email = _email()
    last_code: list[str] = []

    async def capture(to_email: str, code: str) -> None:
        last_code.append(code)

    with patch("services.email_service.send_otp_email", new=AsyncMock(side_effect=capture)):
        signup = client.post("/api/auth/signup", json={"email": email, "password": "very-secure-pass"})

    before_verify = datetime.now(timezone.utc)
    verify = client.post(
        "/api/auth/verify-otp",
        json={"pendingUserId": signup.json()["data"]["pendingUserId"], "code": last_code[0]},
    )
    after_verify = datetime.now(timezone.utc)

    assert verify.status_code == 200
    with SessionLocal() as db:
        user = db.scalar(select(AppUser).where(AppUser.email == email))
        verified_until = user.otp_verified_until.replace(tzinfo=timezone.utc)

    assert before_verify + timedelta(hours=4) <= verified_until <= after_verify + timedelta(hours=4)


def test_signin_skips_otp_when_recently_verified(client):
    email = _email()
    _signup_and_login(client, email)
    client.post("/api/auth/signout")

    with patch("services.email_service.send_otp_email", new=AsyncMock()) as send_otp:
        signin = client.post("/api/auth/signin", json={"email": email, "password": "very-secure-pass"})

    assert signin.status_code == 200
    assert signin.json()["data"]["user"]["email"] == email
    assert "pendingUserId" not in signin.json()["data"]
    assert "access_token=" in signin.headers["set-cookie"]
    send_otp.assert_not_called()


def test_signin_requires_otp_after_recent_verification_expires(client):
    email = _email()
    _signup_and_login(client, email)
    client.post("/api/auth/signout")

    with SessionLocal() as db:
        user = db.scalar(select(AppUser).where(AppUser.email == email))
        user.otp_verified_until = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()

    with patch("services.email_service.send_otp_email", new=AsyncMock()) as send_otp:
        signin = client.post("/api/auth/signin", json={"email": email, "password": "very-secure-pass"})

    assert signin.status_code == 200
    assert signin.json()["data"]["pendingUserId"]
    assert "set-cookie" not in signin.headers
    send_otp.assert_called_once()


def test_protected_routes_require_session(client):
    response = client.get("/api/loans")
    assert response.status_code == 401


def test_authenticated_user_can_create_loan(client):
    email = _email()
    _signup_and_login(client, email)

    response = client.post(
        "/api/loans",
        json={
            "name": "Car",
            "principal": 12000,
            "interestRate": 6.5,
            "loanTerm": 48,
            "monthlyPayment": 284.55,
            "totalAmountPaid": 13658.4,
            "totalInterest": 1658.4,
        },
    )

    assert response.status_code == 201
    assert response.json()["data"]["name"] == "Car"


def test_authenticated_user_can_create_asset(client):
    email = _email()
    _signup_and_login(client, email)

    response = client.post(
        "/api/assets",
        json={
            "name": "Emergency Fund",
            "assetType": "Cash",
            "value": 15000,
            "institution": "Local Bank",
        },
    )

    assert response.status_code == 201
    assert response.json()["data"]["name"] == "Emergency Fund"
    assert response.json()["data"]["assetType"] == "Cash"

    assets = client.get("/api/assets")
    assert assets.status_code == 200
    assert any(asset["name"] == "Emergency Fund" for asset in assets.json()["data"])


def test_password_reset_changes_password(client):
    email = _email()

    with patch("services.email_service.send_otp_email", new=AsyncMock()):
        client.post("/api/auth/signup", json={"email": email, "password": "very-secure-pass"})

    reset = client.post("/api/auth/request-password-reset", json={"email": email})
    assert reset.status_code == 200
    token = reset.json()["data"]["resetToken"]

    changed = client.post("/api/auth/reset-password", json={"token": token, "password": "new-secure-pass"})
    assert changed.status_code == 200

    old_login = client.post("/api/auth/signin", json={"email": email, "password": "very-secure-pass"})
    assert old_login.status_code == 401

    new_login = client.post("/api/auth/signin", json={"email": email, "password": "new-secure-pass"})
    assert new_login.status_code == 200
    assert new_login.json()["data"]["pendingUserId"]


def test_password_reset_clears_recent_otp_trust(client):
    email = _email()
    _signup_and_login(client, email)

    with SessionLocal() as db:
        user = db.scalar(select(AppUser).where(AppUser.email == email))
        assert user.otp_verified_until is not None

    reset = client.post("/api/auth/request-password-reset", json={"email": email})
    changed = client.post(
        "/api/auth/reset-password",
        json={"token": reset.json()["data"]["resetToken"], "password": "new-secure-pass"},
    )

    assert changed.status_code == 200
    with SessionLocal() as db:
        user = db.scalar(select(AppUser).where(AppUser.email == email))
        assert user.otp_verified_until is None
