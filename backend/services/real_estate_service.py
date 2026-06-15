"""Real estate listing search.

Searches live listings through RentCast when RENTCAST_API_KEY is configured
(US coverage). Otherwise falls back to a built-in worldwide sample dataset so
the feature works without an API key; sample listings are flagged with
source="sample" and use USD estimates for cross-market comparability.
"""
import logging
import os
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from services import api_usage_service, listing_cache_service

logger = logging.getLogger(__name__)

RENTCAST_API_URL = os.getenv("RENTCAST_API_URL", "https://api.rentcast.io/v1")
RENTCAST_PROVIDER = "rentcast"
DEFAULT_TIMEOUT = httpx.Timeout(10.0)

# Curated worldwide sample listings. Prices/rents are USD estimates intended
# for exploring the profitability calculator, not live market data.
SAMPLE_LISTINGS: list[dict] = [
    {"id": "sample-nyc-1", "address": "245 W 51st St #8C", "city": "New York", "country": "United States", "propertyType": "Condo", "price": 985000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 88, "estimatedMonthlyRent": 4900, "propertyTaxRatePct": 1.9, "yearBuilt": 1987},
    {"id": "sample-austin-1", "address": "1804 Larkspur Ln", "city": "Austin", "country": "United States", "propertyType": "Single Family", "price": 465000, "currency": "USD", "bedrooms": 3, "bathrooms": 2, "areaSqm": 158, "estimatedMonthlyRent": 2450, "propertyTaxRatePct": 1.8, "yearBuilt": 2004},
    {"id": "sample-cleveland-1", "address": "3315 Archwood Ave", "city": "Cleveland", "country": "United States", "propertyType": "Multi Family", "price": 152000, "currency": "USD", "bedrooms": 4, "bathrooms": 2, "areaSqm": 190, "estimatedMonthlyRent": 1980, "propertyTaxRatePct": 2.2, "yearBuilt": 1948},
    {"id": "sample-toronto-1", "address": "85 Queens Wharf Rd #1205", "city": "Toronto", "country": "Canada", "propertyType": "Condo", "price": 545000, "currency": "USD", "bedrooms": 1, "bathrooms": 1, "areaSqm": 55, "estimatedMonthlyRent": 1950, "propertyTaxRatePct": 0.7, "yearBuilt": 2017},
    {"id": "sample-mexico-1", "address": "Av. Ámsterdam 241, Condesa", "city": "Mexico City", "country": "Mexico", "propertyType": "Apartment", "price": 295000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 105, "estimatedMonthlyRent": 1750, "propertyTaxRatePct": 0.1, "yearBuilt": 1962},
    {"id": "sample-london-1", "address": "14 Dalston Ln, Hackney", "city": "London", "country": "United Kingdom", "propertyType": "Flat", "price": 620000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 68, "estimatedMonthlyRent": 2850, "propertyTaxRatePct": 0.5, "yearBuilt": 1996},
    {"id": "sample-manchester-1", "address": "12 Blossom St, Ancoats", "city": "Manchester", "country": "United Kingdom", "propertyType": "Flat", "price": 248000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 71, "estimatedMonthlyRent": 1550, "propertyTaxRatePct": 0.6, "yearBuilt": 2019},
    {"id": "sample-berlin-1", "address": "Schönhauser Allee 112", "city": "Berlin", "country": "Germany", "propertyType": "Apartment", "price": 410000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 74, "estimatedMonthlyRent": 1500, "propertyTaxRatePct": 0.3, "yearBuilt": 1908},
    {"id": "sample-lisbon-1", "address": "Rua dos Anjos 38", "city": "Lisbon", "country": "Portugal", "propertyType": "Apartment", "price": 385000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 82, "estimatedMonthlyRent": 1900, "propertyTaxRatePct": 0.4, "yearBuilt": 1972},
    {"id": "sample-madrid-1", "address": "Calle de Embajadores 56", "city": "Madrid", "country": "Spain", "propertyType": "Apartment", "price": 340000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 78, "estimatedMonthlyRent": 1600, "propertyTaxRatePct": 0.5, "yearBuilt": 1965},
    {"id": "sample-paris-1", "address": "27 Rue Oberkampf", "city": "Paris", "country": "France", "propertyType": "Apartment", "price": 540000, "currency": "USD", "bedrooms": 1, "bathrooms": 1, "areaSqm": 46, "estimatedMonthlyRent": 1700, "propertyTaxRatePct": 1.0, "yearBuilt": 1900},
    {"id": "sample-warsaw-1", "address": "ul. Marszałkowska 84", "city": "Warsaw", "country": "Poland", "propertyType": "Apartment", "price": 265000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 64, "estimatedMonthlyRent": 1450, "propertyTaxRatePct": 0.2, "yearBuilt": 2013},
    {"id": "sample-athens-1", "address": "Mavromichali 22, Exarchia", "city": "Athens", "country": "Greece", "propertyType": "Apartment", "price": 175000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 85, "estimatedMonthlyRent": 1050, "propertyTaxRatePct": 0.3, "yearBuilt": 1978},
    {"id": "sample-dubai-1", "address": "Marina Gate Tower 2 #2807", "city": "Dubai", "country": "United Arab Emirates", "propertyType": "Apartment", "price": 480000, "currency": "USD", "bedrooms": 1, "bathrooms": 2, "areaSqm": 80, "estimatedMonthlyRent": 2900, "propertyTaxRatePct": 0.0, "yearBuilt": 2018},
    {"id": "sample-istanbul-1", "address": "Caferağa Mah., Kadıköy", "city": "Istanbul", "country": "Turkey", "propertyType": "Apartment", "price": 210000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 95, "estimatedMonthlyRent": 1150, "propertyTaxRatePct": 0.2, "yearBuilt": 1999},
    {"id": "sample-capetown-1", "address": "12 Kloof St, Gardens", "city": "Cape Town", "country": "South Africa", "propertyType": "Apartment", "price": 185000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 90, "estimatedMonthlyRent": 1350, "propertyTaxRatePct": 0.7, "yearBuilt": 2008},
    {"id": "sample-tokyo-1", "address": "2-14-6 Nakameguro, Meguro-ku", "city": "Tokyo", "country": "Japan", "propertyType": "Apartment", "price": 520000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 62, "estimatedMonthlyRent": 2300, "propertyTaxRatePct": 1.4, "yearBuilt": 2011},
    {"id": "sample-osaka-1", "address": "1-9-12 Namba, Chuo-ku", "city": "Osaka", "country": "Japan", "propertyType": "Apartment", "price": 235000, "currency": "USD", "bedrooms": 1, "bathrooms": 1, "areaSqm": 45, "estimatedMonthlyRent": 1250, "propertyTaxRatePct": 1.4, "yearBuilt": 2009},
    {"id": "sample-singapore-1", "address": "8 Boon Keng Rd #15-22", "city": "Singapore", "country": "Singapore", "propertyType": "Condo", "price": 890000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 72, "estimatedMonthlyRent": 3300, "propertyTaxRatePct": 1.2, "yearBuilt": 2015},
    {"id": "sample-bangkok-1", "address": "Sukhumvit 36, Thong Lo", "city": "Bangkok", "country": "Thailand", "propertyType": "Condo", "price": 230000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 75, "estimatedMonthlyRent": 1550, "propertyTaxRatePct": 0.3, "yearBuilt": 2016},
    {"id": "sample-bali-1", "address": "Jl. Pantai Berawa, Canggu", "city": "Canggu", "country": "Indonesia", "propertyType": "Villa", "price": 320000, "currency": "USD", "bedrooms": 3, "bathrooms": 3, "areaSqm": 210, "estimatedMonthlyRent": 2800, "propertyTaxRatePct": 0.3, "yearBuilt": 2020},
    {"id": "sample-kualalumpur-1", "address": "Jalan Ampang, KLCC", "city": "Kuala Lumpur", "country": "Malaysia", "propertyType": "Condo", "price": 265000, "currency": "USD", "bedrooms": 3, "bathrooms": 2, "areaSqm": 120, "estimatedMonthlyRent": 1500, "propertyTaxRatePct": 0.2, "yearBuilt": 2014},
    {"id": "sample-sydney-1", "address": "501/2 Atchison St, Crows Nest", "city": "Sydney", "country": "Australia", "propertyType": "Apartment", "price": 730000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 85, "estimatedMonthlyRent": 3100, "propertyTaxRatePct": 0.4, "yearBuilt": 2012},
    {"id": "sample-auckland-1", "address": "18 Sale St, Freemans Bay", "city": "Auckland", "country": "New Zealand", "propertyType": "Apartment", "price": 495000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 70, "estimatedMonthlyRent": 2100, "propertyTaxRatePct": 0.6, "yearBuilt": 2006},
    {"id": "sample-saopaulo-1", "address": "Rua Augusta 2210, Jardins", "city": "São Paulo", "country": "Brazil", "propertyType": "Apartment", "price": 195000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 88, "estimatedMonthlyRent": 1300, "propertyTaxRatePct": 1.0, "yearBuilt": 2001},
    {"id": "sample-buenosaires-1", "address": "Gorriti 4860, Palermo Soho", "city": "Buenos Aires", "country": "Argentina", "propertyType": "Apartment", "price": 145000, "currency": "USD", "bedrooms": 2, "bathrooms": 1, "areaSqm": 76, "estimatedMonthlyRent": 950, "propertyTaxRatePct": 0.6, "yearBuilt": 1994},
    {"id": "sample-medellin-1", "address": "Cra. 35 #7-99, El Poblado", "city": "Medellín", "country": "Colombia", "propertyType": "Apartment", "price": 165000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 95, "estimatedMonthlyRent": 1250, "propertyTaxRatePct": 0.7, "yearBuilt": 2010},
    {"id": "sample-panama-1", "address": "Calle Uruguay, Bella Vista", "city": "Panama City", "country": "Panama", "propertyType": "Condo", "price": 215000, "currency": "USD", "bedrooms": 2, "bathrooms": 2, "areaSqm": 100, "estimatedMonthlyRent": 1400, "propertyTaxRatePct": 0.6, "yearBuilt": 2013},
]


def _rentcast_api_key() -> str | None:
    return os.getenv("RENTCAST_API_KEY") or None


def _monthly_limit() -> int:
    return int(os.getenv("RENTCAST_MONTHLY_LIMIT", "50"))


def _billing_anchor_day() -> int:
    return int(os.getenv("RENTCAST_BILLING_DAY", "1"))


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _now_dt() -> datetime:
    return datetime.now(timezone.utc)


def _cache_ttl_days() -> int:
    return int(os.getenv("RENTCAST_CACHE_DAYS", "30"))


def _cache_key(city: str, state: str, property_type: str | None) -> str:
    """Key on the params that vary the RentCast request — price/bedroom filters
    are applied to cached results, so they must NOT be part of the key."""
    return f"{city.strip().lower()}|{state.strip().lower()}|{(property_type or '*').strip().lower()}"


def usage_summary(db: Session) -> dict:
    """Current RentCast quota usage for the active billing period."""
    anchor_day = _billing_anchor_day()
    period_start = api_usage_service.current_period_start(_today(), anchor_day)
    period_end = api_usage_service.next_period_start(period_start, anchor_day) - timedelta(days=1)
    limit = _monthly_limit()
    used = api_usage_service.get_count(db, RENTCAST_PROVIDER, period_start)
    return {
        "provider": RENTCAST_PROVIDER,
        "configured": bool(_rentcast_api_key()),
        "used": used,
        "limit": limit,
        "remaining": max(0, limit - used),
        "periodStart": period_start.isoformat(),
        "periodEnd": period_end.isoformat(),
    }


def _matches(listing: dict, location: str, min_price: float | None, max_price: float | None,
             property_type: str | None, min_bedrooms: int | None) -> bool:
    if location:
        haystack = f"{listing['address']} {listing['city']} {listing['country']}".lower()
        if not all(term in haystack for term in location.lower().replace(",", " ").split()):
            return False
    if min_price is not None and listing["price"] < min_price:
        return False
    if max_price is not None and listing["price"] > max_price:
        return False
    if property_type and listing["propertyType"].lower() != property_type.lower():
        return False
    if min_bedrooms is not None and (listing["bedrooms"] or 0) < min_bedrooms:
        return False
    return True


def _search_sample(location: str, min_price: float | None, max_price: float | None,
                   property_type: str | None, min_bedrooms: int | None, limit: int) -> list[dict]:
    results = [
        {**listing, "source": "sample"}
        for listing in SAMPLE_LISTINGS
        if _matches(listing, location, min_price, max_price, property_type, min_bedrooms)
    ]
    return results[:limit]


def _parse_us_location(location: str) -> tuple[str, str] | None:
    """Parse "City, ST" into (city, state) for RentCast; None when not US-shaped."""
    parts = [part.strip() for part in location.split(",")]
    if len(parts) == 2 and len(parts[1]) == 2 and parts[1].isalpha():
        return parts[0], parts[1].upper()
    return None


def _map_rentcast_listing(item: dict) -> dict:
    sqft = item.get("squareFootage")
    price = item.get("price") or 0
    return {
        "id": str(item.get("id") or item.get("formattedAddress") or ""),
        "address": item.get("formattedAddress") or item.get("addressLine1") or "",
        "city": item.get("city") or "",
        "country": "United States",
        "propertyType": item.get("propertyType") or "Unknown",
        "price": price,
        "currency": "USD",
        "bedrooms": item.get("bedrooms"),
        "bathrooms": item.get("bathrooms"),
        "areaSqm": round(sqft * 0.092903, 1) if sqft else None,
        # ~0.7% of price per year is a coarse rent heuristic when no estimate exists
        "estimatedMonthlyRent": round(price * 0.007, 0) if price else None,
        "propertyTaxRatePct": 1.1,
        "yearBuilt": item.get("yearBuilt"),
        "source": "rentcast",
    }


async def _fetch_rentcast(city: str, state: str, property_type: str | None, limit: int) -> list[dict]:
    """Fetch and map listings from RentCast. Returns the full set for the city —
    price/bedroom filtering happens later so cached results can be re-filtered."""
    params: dict = {"city": city, "state": state, "status": "Active", "limit": limit}
    if property_type:
        # RentCast hyphenates this type; the UI label does not
        params["propertyType"] = "Multi-Family" if property_type.lower() == "multi family" else property_type
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(
            f"{RENTCAST_API_URL}/listings/sale",
            params=params,
            headers={"X-Api-Key": _rentcast_api_key() or ""},
        )
        response.raise_for_status()
        items = response.json() or []
    return [_map_rentcast_listing(item) for item in items]


def _filter_listings(listings: list[dict], min_price: float | None, max_price: float | None,
                     min_bedrooms: int | None, limit: int) -> list[dict]:
    return [
        listing for listing in listings
        if _matches(listing, "", min_price, max_price, None, min_bedrooms)
    ][:limit]


def _rentcast_result(listings: list[dict], cached: bool, fetched_at: datetime,
                     db: Session | None, quota_exhausted: bool = False) -> dict:
    return {
        "listings": listings,
        "source": "rentcast",
        "cached": cached,
        "cachedAt": fetched_at.isoformat(),
        "usage": usage_summary(db) if db is not None else None,
        "quotaExhausted": quota_exhausted,
    }


async def search_listings(location: str = "", min_price: float | None = None, max_price: float | None = None,
                          property_type: str | None = None, min_bedrooms: int | None = None,
                          limit: int = 50, db: Session | None = None, refresh: bool = False) -> dict:
    """Search listings; returns {"listings", "source", "cached", "cachedAt", "usage", "quotaExhausted"}.

    To conserve the valuable RentCast quota, responses are cached for
    RENTCAST_CACHE_DAYS (default 30): a repeat search of the same city reuses
    the stored call instead of spending another request. Live calls are also
    gated by a persistent monthly counter so the cap is never exceeded; when
    it is reached we serve stale cache if available, otherwise sample data.
    Pass refresh=True to bypass the cache and force a fresh (quota-spending) call.
    """
    us_location = _parse_us_location(location) if location else None
    quota_exhausted = False

    if _rentcast_api_key() and us_location and db is not None:
        city, state = us_location
        key = _cache_key(city, state, property_type)
        now = _now_dt()

        # 1. Fresh cache hit — no quota spent
        if not refresh:
            cached = listing_cache_service.get_fresh(db, RENTCAST_PROVIDER, key, _cache_ttl_days(), now)
            if cached is not None:
                listings, fetched_at = cached
                return _rentcast_result(
                    _filter_listings(listings, min_price, max_price, min_bedrooms, limit),
                    cached=True, fetched_at=fetched_at, db=db,
                )

        # 2. Need a live call — reserve quota first (a failed call still counts)
        period_start = api_usage_service.current_period_start(_today(), _billing_anchor_day())
        if api_usage_service.try_consume(db, RENTCAST_PROVIDER, period_start, _monthly_limit()):
            try:
                raw = await _fetch_rentcast(city, state, property_type, limit)
                listing_cache_service.store(db, RENTCAST_PROVIDER, key, raw, now)
                return _rentcast_result(
                    _filter_listings(raw, min_price, max_price, min_bedrooms, limit),
                    cached=False, fetched_at=now, db=db,
                )
            except Exception:
                logger.exception("RentCast search failed; trying stale cache then sample data")
        else:
            quota_exhausted = True
            logger.warning("RentCast monthly quota reached; trying stale cache then sample data")

        # 3. Live call unavailable — serve stale cache (any age) before sample
        stale = listing_cache_service.get(db, RENTCAST_PROVIDER, key)
        if stale is not None:
            listings, fetched_at = stale
            return _rentcast_result(
                _filter_listings(listings, min_price, max_price, min_bedrooms, limit),
                cached=True, fetched_at=fetched_at, db=db, quota_exhausted=quota_exhausted,
            )

    return {
        "listings": _search_sample(location, min_price, max_price, property_type, min_bedrooms, limit),
        "source": "sample",
        "cached": False,
        "cachedAt": None,
        "usage": usage_summary(db) if db is not None else None,
        "quotaExhausted": quota_exhausted,
    }
