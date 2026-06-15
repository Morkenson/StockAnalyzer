from unittest.mock import AsyncMock, patch
from uuid import uuid4

from services.tax_service import calculate_taxes


def _email() -> str:
    return f"user-{uuid4()}@example.com"


def _signup_and_login(client, email: str, password: str = "very-secure-pass") -> None:
    last_code: list[str] = []

    async def capture(to_email: str, code: str) -> None:
        last_code.append(code)

    with patch("services.email_service.send_otp_email", new=AsyncMock(side_effect=capture)):
        resp = client.post("/api/auth/signup", json={"email": email, "password": password})

    assert resp.status_code == 201
    pending_user_id = resp.json()["data"]["pendingUserId"]
    client.post("/api/auth/verify-otp", json={"pendingUserId": pending_user_id, "code": last_code[0]})


def _profile_payload(**overrides) -> dict:
    payload = {
        "taxYear": 2025,
        "filingStatus": "single",
        "grossIncome": 120000,
        "preTaxContributions": 12000,
        "useItemized": False,
        "itemizedDeduction": 0,
        "withholdingsPaid": 25000,
    }
    payload.update(overrides)
    return payload


def test_tax_routes_require_session(client):
    assert client.get("/api/taxes/profile").status_code == 401
    assert client.put("/api/taxes/profile", json=_profile_payload()).status_code == 401
    assert client.post("/api/taxes/calculate", json=_profile_payload()).status_code == 401


def test_profile_upsert_get_and_calculate(client):
    _signup_and_login(client, _email())

    empty = client.get("/api/taxes/profile")
    assert empty.status_code == 200
    assert empty.json()["data"] is None

    created = client.put("/api/taxes/profile", json=_profile_payload())
    assert created.status_code == 200
    row = created.json()["data"]
    assert row["filingStatus"] == "single"
    assert row["grossIncome"] == 120000

    updated = client.put("/api/taxes/profile", json=_profile_payload(filingStatus="married_joint", grossIncome=160000))
    assert updated.status_code == 200
    assert updated.json()["data"]["filingStatus"] == "married_joint"
    assert client.get("/api/taxes/profile").json()["data"]["grossIncome"] == 160000

    calculated = client.post("/api/taxes/calculate", json=_profile_payload(grossIncome=120000))
    assert calculated.status_code == 200
    data = calculated.json()["data"]
    assert data["agi"] == 108000
    assert data["taxableIncome"] == 93000
    assert data["federalTax"] > 0
    assert data["ficaTax"] > 0
    assert data["stateTax"] > 0
    assert data["balanceDue"] == round(data["totalTax"] - 25000, 2)


def test_profile_is_scoped_to_owner(client):
    _signup_and_login(client, _email())
    saved = client.put("/api/taxes/profile", json=_profile_payload()).json()["data"]
    client.post("/api/auth/signout")

    _signup_and_login(client, _email())
    assert client.get("/api/taxes/profile").json()["data"] is None
    second = client.put("/api/taxes/profile", json=_profile_payload(grossIncome=50000)).json()["data"]
    assert second["id"] != saved["id"]
    assert client.get("/api/taxes/profile").json()["data"]["grossIncome"] == 50000


def test_calculate_taxes_single_standard():
    result = calculate_taxes(_profile_payload(grossIncome=120000, preTaxContributions=12000, withholdingsPaid=0))
    assert result["agi"] == 108000
    assert result["deduction"] == 15000
    assert result["taxableIncome"] == 93000
    assert result["federalTax"] == 15374
    assert result["socialSecurityTax"] == 7440
    assert result["medicareTax"] == 1740
    assert result["stateTax"] == 4532.55
    assert result["totalTax"] == 29086.55


def test_calculate_taxes_married_joint_and_itemized():
    result = calculate_taxes(
        _profile_payload(
            filingStatus="married_joint",
            grossIncome=180000,
            preTaxContributions=20000,
            useItemized=True,
            itemizedDeduction=40000,
        )
    )
    assert result["deduction"] == 40000
    assert result["taxableIncome"] == 120000
    assert result["federalTax"] == 16228
    assert result["stateTax"] == 5831.43


def test_calculate_taxes_head_of_household():
    result = calculate_taxes(
        _profile_payload(filingStatus="head_of_household", grossIncome=90000, preTaxContributions=0, withholdingsPaid=0)
    )
    assert result["deduction"] == 22500
    assert result["taxableIncome"] == 67500
    assert result["federalTax"] == 8025


def test_calculate_taxes_fica_caps_and_additional_medicare():
    result = calculate_taxes(_profile_payload(grossIncome=300000, withholdingsPaid=0))
    assert result["socialSecurityTax"] == 10918.2
    assert result["medicareTax"] == 4350
    assert result["additionalMedicareTax"] == 900


def test_calculate_taxes_refund_case():
    result = calculate_taxes(_profile_payload(grossIncome=60000, withholdingsPaid=20000))
    assert result["balanceDue"] < 0
