from uuid import uuid4


def _email() -> str:
    return f"user-{uuid4()}@example.com"


def test_signup_sets_http_only_cookie_and_me_returns_user(client):
    email = _email()
    response = client.post("/api/auth/signup", json={"email": email, "password": "very-secure-pass"})

    assert response.status_code == 201
    assert response.json()["data"]["user"]["email"] == email
    assert "access_token=" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["data"]["user"]["email"] == email


def test_protected_routes_require_session(client):
    response = client.get("/api/loans")
    assert response.status_code == 401


def test_authenticated_user_can_create_loan(client):
    client.post("/api/auth/signup", json={"email": _email(), "password": "very-secure-pass"})

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


def test_password_reset_changes_password(client):
    email = _email()
    client.post("/api/auth/signup", json={"email": email, "password": "very-secure-pass"})
    client.post("/api/auth/signout")

    reset = client.post("/api/auth/request-password-reset", json={"email": email})
    assert reset.status_code == 200
    token = reset.json()["data"]["resetToken"]

    changed = client.post("/api/auth/reset-password", json={"token": token, "password": "new-secure-pass"})
    assert changed.status_code == 200

    old_login = client.post("/api/auth/signin", json={"email": email, "password": "very-secure-pass"})
    assert old_login.status_code == 401

    new_login = client.post("/api/auth/signin", json={"email": email, "password": "new-secure-pass"})
    assert new_login.status_code == 200
