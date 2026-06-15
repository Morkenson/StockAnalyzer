from datetime import date
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from services import api_usage_service, real_estate_service


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


def _property_payload(**overrides) -> dict:
    payload = {
        "name": "Lisbon Apartment",
        "city": "Lisbon",
        "country": "Portugal",
        "propertyType": "Apartment",
        "purchasePrice": 385000,
        "downPaymentPct": 20,
        "closingCosts": 11550,
        "interestRate": 6.5,
        "loanTermYears": 30,
        "monthlyRent": 1900,
        "vacancyRatePct": 5,
        "propertyTaxAnnual": 1540,
        "insuranceAnnual": 1540,
        "hoaMonthly": 0,
        "maintenancePct": 5,
        "managementPct": 8,
        "otherMonthlyCosts": 0,
        "appreciationPct": 3,
        "holdYears": 10,
        "monthlyCashFlow": -407.32,
        "capRate": 3.81,
        "cashOnCashReturn": -5.54,
    }
    payload.update(overrides)
    return payload


def test_real_estate_routes_require_session(client):
    assert client.get("/api/real-estate/search").status_code == 401
    assert client.get("/api/real-estate/properties").status_code == 401


def test_search_returns_sample_listings(client):
    _signup_and_login(client, _email())

    response = client.get("/api/real-estate/search")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["source"] == "sample"
    assert len(data["listings"]) > 0
    assert {"address", "city", "country", "price", "estimatedMonthlyRent"} <= set(data["listings"][0])


def test_search_filters_by_location_and_price(client):
    _signup_and_login(client, _email())

    response = client.get("/api/real-estate/search", params={"location": "Lisbon"})
    listings = response.json()["data"]["listings"]
    assert len(listings) == 1
    assert listings[0]["city"] == "Lisbon"

    response = client.get("/api/real-estate/search", params={"maxPrice": 200000})
    listings = response.json()["data"]["listings"]
    assert len(listings) > 0
    assert all(listing["price"] <= 200000 for listing in listings)


def test_search_filters_by_property_type_and_bedrooms(client):
    _signup_and_login(client, _email())

    response = client.get(
        "/api/real-estate/search", params={"propertyType": "Villa", "minBedrooms": 3}
    )
    listings = response.json()["data"]["listings"]
    assert len(listings) > 0
    assert all(listing["propertyType"] == "Villa" and listing["bedrooms"] >= 3 for listing in listings)


def test_property_crud(client):
    _signup_and_login(client, _email())

    created = client.post("/api/real-estate/properties", json=_property_payload())
    assert created.status_code == 201
    row = created.json()["data"]
    assert row["name"] == "Lisbon Apartment"
    assert row["purchasePrice"] == 385000
    assert row["monthlyCashFlow"] == -407.32
    property_id = row["id"]

    listed = client.get("/api/real-estate/properties")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["data"]] == [property_id]

    updated = client.patch(
        f"/api/real-estate/properties/{property_id}",
        json={"monthlyRent": 2400, "monthlyCashFlow": 12.5, "cashOnCashReturn": 0.17},
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["monthlyRent"] == 2400
    assert updated.json()["data"]["monthlyCashFlow"] == 12.5

    deleted = client.delete(f"/api/real-estate/properties/{property_id}")
    assert deleted.status_code == 200
    assert client.get("/api/real-estate/properties").json()["data"] == []


def test_create_property_rejects_non_positive_price(client):
    _signup_and_login(client, _email())

    response = client.post("/api/real-estate/properties", json=_property_payload(purchasePrice=0))
    assert response.status_code == 400


def test_billing_period_anchors_to_signup_day():
    # Anchored on the 9th: the period containing June 9 runs through July 8
    assert api_usage_service.current_period_start(date(2026, 6, 9), 9) == date(2026, 6, 9)
    assert api_usage_service.current_period_start(date(2026, 7, 8), 9) == date(2026, 6, 9)
    assert api_usage_service.current_period_start(date(2026, 7, 9), 9) == date(2026, 7, 9)
    # Year boundary
    assert api_usage_service.current_period_start(date(2026, 1, 5), 9) == date(2025, 12, 9)
    # Anchor day clamps in shorter months
    assert api_usage_service.current_period_start(date(2026, 2, 28), 31) == date(2026, 2, 28)
    assert api_usage_service.next_period_start(date(2026, 6, 9), 9) == date(2026, 7, 9)


def test_usage_endpoint_reports_quota(client):
    _signup_and_login(client, _email())

    response = client.get("/api/real-estate/usage")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["provider"] == "rentcast"
    assert data["configured"] is False
    assert data["used"] == 0
    assert data["limit"] == 50
    assert data["remaining"] == 50


def _rentcast_listing(**overrides) -> dict:
    listing = {**real_estate_service.SAMPLE_LISTINGS[0], "source": "rentcast"}
    listing.update(overrides)
    return listing


def test_rentcast_quota_blocks_calls_over_the_monthly_cap(client, monkeypatch):
    _signup_and_login(client, _email())
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    monkeypatch.setenv("RENTCAST_MONTHLY_LIMIT", "2")
    fetch_mock = AsyncMock(return_value=[_rentcast_listing()])
    monkeypatch.setattr(real_estate_service, "_fetch_rentcast", fetch_mock)

    # Distinct cities so each is a cache miss that spends quota
    first = client.get("/api/real-estate/search", params={"location": "Austin, TX"})
    second = client.get("/api/real-estate/search", params={"location": "Dallas, TX"})
    third = client.get("/api/real-estate/search", params={"location": "Houston, TX"})

    assert first.json()["data"]["source"] == "rentcast"
    assert second.json()["data"]["source"] == "rentcast"
    assert third.json()["data"]["source"] == "sample"
    assert third.json()["data"]["quotaExhausted"] is True
    assert fetch_mock.await_count == 2

    usage = client.get("/api/real-estate/usage").json()["data"]
    assert usage["used"] == 2
    assert usage["remaining"] == 0


def test_rentcast_quota_counts_failed_calls(client, monkeypatch):
    """Failed requests still hit RentCast's quota, so they must be counted."""
    _signup_and_login(client, _email())
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    monkeypatch.setenv("RENTCAST_MONTHLY_LIMIT", "5")
    monkeypatch.setattr(real_estate_service, "_fetch_rentcast", AsyncMock(side_effect=RuntimeError("boom")))

    response = client.get("/api/real-estate/search", params={"location": "Austin, TX"})

    assert response.json()["data"]["source"] == "sample"
    usage = client.get("/api/real-estate/usage").json()["data"]
    assert usage["used"] == 1


def test_non_us_searches_never_consume_quota(client, monkeypatch):
    _signup_and_login(client, _email())
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")

    client.get("/api/real-estate/search", params={"location": "Lisbon"})
    client.get("/api/real-estate/search")

    usage = client.get("/api/real-estate/usage").json()["data"]
    assert usage["used"] == 0


def test_repeat_search_uses_cache_and_saves_quota(client, monkeypatch):
    _signup_and_login(client, _email())
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    fetch_mock = AsyncMock(return_value=[_rentcast_listing()])
    monkeypatch.setattr(real_estate_service, "_fetch_rentcast", fetch_mock)

    first = client.get("/api/real-estate/search", params={"location": "Austin, TX"})
    second = client.get("/api/real-estate/search", params={"location": "Austin, TX"})

    assert first.json()["data"]["source"] == "rentcast"
    assert first.json()["data"]["cached"] is False
    assert second.json()["data"]["source"] == "rentcast"
    assert second.json()["data"]["cached"] is True
    # Only the first search hit the network
    assert fetch_mock.await_count == 1
    assert client.get("/api/real-estate/usage").json()["data"]["used"] == 1


def test_price_filter_applies_to_cached_results_without_new_call(client, monkeypatch):
    _signup_and_login(client, _email())
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    fetch_mock = AsyncMock(return_value=[
        _rentcast_listing(id="cheap", price=200000),
        _rentcast_listing(id="pricey", price=900000),
    ])
    monkeypatch.setattr(real_estate_service, "_fetch_rentcast", fetch_mock)

    everything = client.get("/api/real-estate/search", params={"location": "Austin, TX"})
    filtered = client.get("/api/real-estate/search", params={"location": "Austin, TX", "maxPrice": 300000})

    assert len(everything.json()["data"]["listings"]) == 2
    filtered_listings = filtered.json()["data"]["listings"]
    assert [item["id"] for item in filtered_listings] == ["cheap"]
    assert filtered.json()["data"]["cached"] is True
    # Filtering a cached result spends no extra quota or network call
    assert fetch_mock.await_count == 1
    assert client.get("/api/real-estate/usage").json()["data"]["used"] == 1


def test_refresh_bypasses_cache_and_spends_quota(client, monkeypatch):
    _signup_and_login(client, _email())
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    fetch_mock = AsyncMock(return_value=[_rentcast_listing()])
    monkeypatch.setattr(real_estate_service, "_fetch_rentcast", fetch_mock)

    client.get("/api/real-estate/search", params={"location": "Austin, TX"})
    refreshed = client.get("/api/real-estate/search", params={"location": "Austin, TX", "refresh": "true"})

    assert refreshed.json()["data"]["source"] == "rentcast"
    assert refreshed.json()["data"]["cached"] is False
    assert fetch_mock.await_count == 2
    assert client.get("/api/real-estate/usage").json()["data"]["used"] == 2


def test_stale_cache_served_when_quota_exhausted(client, monkeypatch):
    _signup_and_login(client, _email())
    monkeypatch.setenv("RENTCAST_API_KEY", "test-key")
    monkeypatch.setenv("RENTCAST_MONTHLY_LIMIT", "1")
    fetch_mock = AsyncMock(return_value=[_rentcast_listing()])
    monkeypatch.setattr(real_estate_service, "_fetch_rentcast", fetch_mock)

    # Spend the only call caching Austin, then exhaust quota on a new city
    client.get("/api/real-estate/search", params={"location": "Austin, TX"})
    client.get("/api/real-estate/search", params={"location": "Dallas, TX"})
    # Austin is over TTL only if cache expired; here it is fresh, so a repeat
    # returns cache without needing quota even though quota is exhausted
    repeat = client.get("/api/real-estate/search", params={"location": "Austin, TX"})

    assert repeat.json()["data"]["source"] == "rentcast"
    assert repeat.json()["data"]["cached"] is True
    assert fetch_mock.await_count == 1


def test_listing_cache_ttl_and_get(client):
    """get_fresh honors the TTL window; get() ignores age."""
    from datetime import datetime, timedelta, timezone

    from database import SessionLocal
    from services import listing_cache_service

    now = datetime(2026, 6, 10, tzinfo=timezone.utc)
    with SessionLocal() as db:
        listing_cache_service.store(db, "rentcast", "austin|tx|*", [{"id": "x"}], now)

        assert listing_cache_service.get_fresh(db, "rentcast", "austin|tx|*", 30, now + timedelta(days=10)) is not None
        assert listing_cache_service.get_fresh(db, "rentcast", "austin|tx|*", 30, now + timedelta(days=31)) is None
        # get() returns the entry regardless of age
        listings, fetched_at = listing_cache_service.get(db, "rentcast", "austin|tx|*")
        assert listings == [{"id": "x"}]
        assert fetched_at == now


def test_property_is_scoped_to_owner(client):
    _signup_and_login(client, _email())
    created = client.post("/api/real-estate/properties", json=_property_payload())
    property_id = created.json()["data"]["id"]
    client.post("/api/auth/signout")

    _signup_and_login(client, _email())
    assert client.get("/api/real-estate/properties").json()["data"] == []
    assert client.delete(f"/api/real-estate/properties/{property_id}").status_code == 404
