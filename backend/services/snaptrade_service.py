"""SnapTrade API client for broker linking and portfolio data."""
import asyncio
import json
import logging
import time
from collections.abc import Mapping, Sequence
from datetime import date, datetime, timedelta
from statistics import median

from snaptrade_client import exceptions as snaptrade_exceptions
from snaptrade_client import SnapTrade

from config import SNAPTRADE_API_URL, SNAPTRADE_CLIENT_ID, SNAPTRADE_CONSUMER_KEY
from models.snaptrade_models import Account, Brokerage, Holding, Portfolio, RecurringInvestment, SnapTradeUser

logger = logging.getLogger(__name__)
PORTFOLIO_CACHE_TTL_SECONDS = 15 * 60
_portfolio_cache: dict[str, tuple[float, Portfolio]] = {}
_recurring_cache: dict[tuple[str, tuple[str, ...], int], tuple[float, list[RecurringInvestment]]] = {}


class SnapTradeServiceError(RuntimeError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def clear_user_cache(user_id: str) -> None:
    _portfolio_cache.pop(user_id, None)
    for key in list(_recurring_cache):
        if key[0] == user_id:
            _recurring_cache.pop(key, None)


def _cache_active(expires_at: float) -> bool:
    return expires_at > time.monotonic()


def _sdk_client() -> SnapTrade:
    if not SNAPTRADE_CLIENT_ID or not SNAPTRADE_CONSUMER_KEY:
        raise RuntimeError("SnapTrade credentials are not configured")
    return SnapTrade(
        host=SNAPTRADE_API_URL.rstrip("/"),
        client_id=SNAPTRADE_CLIENT_ID,
        consumer_key=SNAPTRADE_CONSUMER_KEY,
    )


def _to_plain(value):
    if hasattr(value, "to_dict"):
        return _to_plain(value.to_dict())
    if isinstance(value, Mapping):
        return {key: _to_plain(item) for key, item in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_to_plain(item) for item in value]
    return value


def _sdk_body(response):
    body = getattr(response, "body", response)
    if isinstance(body, bytes):
        body = body.decode("utf-8")
    if isinstance(body, str):
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return body
    return _to_plain(body)


def _snaptrade_error_message(exc: Exception) -> str:
    api_response = getattr(exc, "api_response", None)
    body = _to_plain(getattr(api_response, "body", None))
    if isinstance(body, Mapping):
        for key in ("message", "detail", "error", "status", "code"):
            if body.get(key):
                return str(body[key])
    status = getattr(api_response, "status", None)
    if status:
        return f"SnapTrade request failed with status {status}"
    return str(exc)


async def _call_snaptrade(operation):
    try:
        return await operation()
    except snaptrade_exceptions.ApiException as exc:
        api_response = getattr(exc, "api_response", None)
        status = getattr(api_response, "status", 400) or 400
        raise SnapTradeServiceError(_snaptrade_error_message(exc), status_code=status) from exc


async def create_user(user_id: str) -> SnapTradeUser:
    result = _sdk_body(
        await _call_snaptrade(
            lambda: _sdk_client().authentication.aregister_snap_trade_user(
                body={"userId": user_id},
                skip_deserialization=False,
            )
        )
    )
    return SnapTradeUser(
        id=result.get("id", "") or result.get("userId", ""),
        user_id=result.get("userId", user_id),
        user_secret=result.get("userSecret"),
        email=result.get("email"),
        created_at=result.get("createdAt"),
    )


async def get_brokerages() -> list[Brokerage]:
    result = _sdk_body(
        await _call_snaptrade(
            lambda: _sdk_client().reference_data.alist_all_brokerages(skip_deserialization=False)
        )
    )
    brokerages = []
    raw_brokerages = result if isinstance(result, list) else result.get("brokerages", [])
    for b in raw_brokerages:
        brokerages.append(
            Brokerage(
                id=b.get("id", ""),
                name=b.get("slug") or b.get("name", ""),
                display_name=b.get("displayName") or b.get("name"),
                supports_oauth=b.get("supportsOAuth", b.get("allows_connection", False)),
            )
        )
    return brokerages


async def initiate_connection(user_id: str, user_secret: str, redirect_uri: str) -> str:
    result = _sdk_body(
        await _call_snaptrade(
            lambda: _sdk_client().authentication.alogin_snap_trade_user(
                query_params={"userId": user_id, "userSecret": user_secret},
                custom_redirect=redirect_uri,
                immediate_redirect=True,
                show_close_button=False,
                connection_portal_version="v4",
                skip_deserialization=True,
            )
        )
    )
    if isinstance(result, str):
        return result
    return result.get("redirectURI") or result.get("loginLink") or result.get("redirectUri") or ""


def _nested(mapping: dict, *keys: str) -> object:
    value: object = mapping
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def _parse_account(element: dict) -> Account:
    total = element.get("balance", {}).get("total", {}) if isinstance(element.get("balance"), dict) else {}
    meta = element.get("meta") if isinstance(element.get("meta"), dict) else {}
    return Account(
        id=element.get("id", ""),
        name=element.get("name", ""),
        account_number=element.get("accountNumber") or element.get("number", ""),
        type=element.get("type") or element.get("raw_type") or meta.get("type", ""),
        brokerage_id=element.get("brokerageId") or element.get("brokerage_authorization", ""),
        balance=element.get("balance") if not isinstance(element.get("balance"), dict) else total.get("amount"),
        currency=element.get("currency") or total.get("currency", "USD"),
    )


def _parse_holding(element: dict) -> Holding:
    symbol = element.get("symbol", "")
    if isinstance(symbol, dict):
        symbol = _nested(symbol, "symbol", "symbol") or symbol.get("symbol") or ""
    qty = _parse_float(element.get("quantity") or element.get("units"))
    avg = _parse_float(element.get("averagePurchasePrice") or element.get("average_purchase_price"))
    curr = _parse_float(element.get("currentPrice") or element.get("price"))
    raw_total = element.get("totalValue") or element.get("total_value")
    if isinstance(raw_total, dict):
        total = _parse_float(raw_total.get("value"), qty * curr)
    else:
        total = _parse_float(raw_total, qty * curr)
    currency = element.get("currency", "USD")
    if isinstance(currency, dict):
        currency = currency.get("code", "USD")
    if currency == "USD" and isinstance(element.get("symbol"), dict):
        currency = _nested(element["symbol"], "symbol", "currency", "code") or currency
    gain_loss = total - (qty * avg)
    gain_pct = (gain_loss / (qty * avg) * 100) if (qty * avg) else 0
    return Holding(
        symbol=str(symbol),
        quantity=qty,
        average_purchase_price=avg,
        current_price=curr,
        total_value=total,
        gain_loss=gain_loss,
        gain_loss_percent=gain_pct,
        currency=str(currency),
    )


def _parse_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value or default)
    except (TypeError, ValueError):
        return default


def _parse_activity_date(value: object) -> date | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            try:
                return date.fromisoformat(value[:10])
            except ValueError:
                return None
    return None


def _parse_activity_symbol(element: dict) -> str:
    symbol = element.get("symbol")
    if isinstance(symbol, dict):
        return str(symbol.get("symbol") or symbol.get("raw_symbol") or "")
    option_symbol = element.get("option_symbol")
    if isinstance(option_symbol, dict):
        return str(option_symbol.get("ticker") or "")
    return str(symbol or "")


def _parse_activity_currency(element: dict) -> str:
    currency = element.get("currency", "USD")
    if isinstance(currency, dict):
        return str(currency.get("code", "USD"))
    return str(currency or "USD")


def _parse_buy_activity(element: dict, account: Account) -> dict[str, object] | None:
    if str(element.get("type", "")).upper() != "BUY":
        return None
    activity_date = _parse_activity_date(element.get("trade_date") or element.get("tradeDate"))
    symbol = _parse_activity_symbol(element)
    if not activity_date or not symbol:
        return None
    amount = abs(_parse_float(element.get("amount")))
    if not amount:
        amount = abs(_parse_float(element.get("price")) * _parse_float(element.get("units")))
    if not amount:
        return None
    return {
        "account_id": account.id,
        "account_name": account.nickname or account.name,
        "symbol": symbol,
        "amount": amount,
        "currency": _parse_activity_currency(element),
        "date": activity_date,
    }


def _frequency_from_interval(days: float) -> tuple[str, int] | None:
    if 5 <= days <= 9:
        return "weekly", 7
    if 12 <= days <= 17:
        return "biweekly", 14
    if 25 <= days <= 35:
        return "monthly", 30
    return None


def _infer_recurring_from_buys(buys: list[dict[str, object]]) -> list[RecurringInvestment]:
    grouped: dict[tuple[str, str], list[dict[str, object]]] = {}
    for buy in buys:
        grouped.setdefault((str(buy["account_id"]), str(buy["symbol"])), []).append(buy)

    inferred: list[RecurringInvestment] = []
    for (_account_id, _symbol), items in grouped.items():
        ordered = sorted(items, key=lambda item: item["date"])
        if len(ordered) < 2:
            continue
        intervals = [
            (ordered[i]["date"] - ordered[i - 1]["date"]).days
            for i in range(1, len(ordered))
            if isinstance(ordered[i]["date"], date) and isinstance(ordered[i - 1]["date"], date)
        ]
        if not intervals:
            continue
        cadence = _frequency_from_interval(median(intervals))
        if not cadence:
            continue

        amounts = [float(item["amount"]) for item in ordered]
        typical_amount = median(amounts)
        tolerance = max(2.0, typical_amount * 0.25)
        matching_amounts = [amount for amount in amounts if abs(amount - typical_amount) <= tolerance]
        if len(matching_amounts) < 2:
            continue

        frequency, interval_days = cadence
        last_date = ordered[-1]["date"]
        confidence = min(0.95, 0.5 + (len(ordered) * 0.1) + (len(matching_amounts) / len(ordered) * 0.2))
        inferred.append(
            RecurringInvestment(
                symbol=str(ordered[-1]["symbol"]),
                account_id=str(ordered[-1]["account_id"]),
                account_name=str(ordered[-1]["account_name"]),
                amount=round(typical_amount, 2),
                currency=str(ordered[-1]["currency"]),
                frequency=frequency,
                confidence=round(confidence, 2),
                occurrences=len(ordered),
                last_date=last_date.isoformat() if isinstance(last_date, date) else "",
                next_estimated_date=(
                    (last_date + timedelta(days=interval_days)).isoformat()
                    if isinstance(last_date, date)
                    else None
                ),
            )
        )
    return sorted(inferred, key=lambda item: (item.account_name, item.symbol))


async def get_accounts(user_id: str, user_secret: str) -> list[Account]:
    result = _sdk_body(
        await _call_snaptrade(
            lambda: _sdk_client().account_information.alist_user_accounts(
                query_params={"userId": user_id, "userSecret": user_secret},
                skip_deserialization=True,
            )
        )
    )
    accounts = []
    if isinstance(result, list):
        for acc in result:
            accounts.append(_parse_account(acc))
        return accounts
    raw = result.get("accounts")
    if isinstance(raw, list):
        for acc in raw:
            accounts.append(_parse_account(acc))
    return accounts


async def get_account_holdings(
    user_id: str, user_secret: str, account_id: str
) -> list[Holding]:
    result = _sdk_body(
        await _call_snaptrade(
            lambda: _sdk_client().account_information.aget_user_holdings(
                account_id=account_id,
                query_params={"userId": user_id, "userSecret": user_secret},
                skip_deserialization=True,
            )
        )
    )
    holdings = []
    raw_holdings = result if isinstance(result, list) else result.get("holdings", []) or result.get("positions", [])
    for elem in raw_holdings:
        holdings.append(_parse_holding(elem))
    return holdings


async def get_account_activities(
    user_id: str,
    user_secret: str,
    account_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
    activity_type: str = "BUY",
) -> list[dict]:
    result = _sdk_body(
        await _call_snaptrade(
            lambda: _sdk_client().account_information.aget_account_activities(
                account_id=account_id,
                user_id=user_id,
                user_secret=user_secret,
                start_date=start_date,
                end_date=end_date,
                limit=1000,
                type=activity_type,
                skip_deserialization=True,
            )
        )
    )
    if isinstance(result, list):
        return result
    if isinstance(result, dict):
        data = result.get("data")
        if isinstance(data, list):
            return data
        activities = result.get("activities")
        if isinstance(activities, list):
            return activities
    return []


async def get_recurring_investments(
    user_id: str,
    user_secret: str,
    accounts: list[Account] | None = None,
    lookback_days: int = 365,
    force_refresh: bool = False,
) -> list[RecurringInvestment]:
    accounts = accounts if accounts is not None else await get_accounts(user_id, user_secret)
    cache_key = (user_id, tuple(sorted(account.id for account in accounts)), lookback_days)
    cached = _recurring_cache.get(cache_key)
    if cached and not force_refresh and _cache_active(cached[0]):
        return [item.model_copy(deep=True) for item in cached[1]]

    end = date.today()
    start = end - timedelta(days=lookback_days)
    activity_results = await asyncio.gather(
        *(
            get_account_activities(user_id, user_secret, account.id, start_date=start, end_date=end)
            for account in accounts
        ),
        return_exceptions=True,
    )

    buys: list[dict[str, object]] = []
    for account, activities in zip(accounts, activity_results):
        if isinstance(activities, Exception):
            logger.warning("Activities failed for account %s: %s", account.id, activities)
            continue
        for activity in activities:
            if not isinstance(activity, dict):
                continue
            parsed = _parse_buy_activity(activity, account)
            if parsed:
                buys.append(parsed)
    recurring = _infer_recurring_from_buys(buys)
    _recurring_cache[cache_key] = (
        time.monotonic() + PORTFOLIO_CACHE_TTL_SECONDS,
        [item.model_copy(deep=True) for item in recurring],
    )
    return recurring


async def get_portfolio(user_id: str, user_secret: str, force_refresh: bool = False) -> Portfolio:
    cached = _portfolio_cache.get(user_id)
    if cached and not force_refresh and _cache_active(cached[0]):
        return cached[1].model_copy(deep=True)

    accounts = await get_accounts(user_id, user_secret)
    holdings_results = await asyncio.gather(
        *(get_account_holdings(user_id, user_secret, acc.id) for acc in accounts),
        return_exceptions=True,
    )
    for acc, holdings in zip(accounts, holdings_results):
        if isinstance(holdings, Exception):
            logger.warning("Holdings failed for account %s: %s", acc.id, holdings)
            continue
        acc.holdings = holdings
    total_balance = sum(a.balance or 0 for a in accounts)
    total_gain_loss = sum(sum(h.gain_loss for h in a.holdings) for a in accounts)
    total_gain_loss_percent = (
        (total_gain_loss / (total_balance - total_gain_loss) * 100)
        if (total_balance - total_gain_loss)
        else 0
    )
    currency = accounts[0].currency if accounts else "USD"
    portfolio = Portfolio(
        user_id=user_id,
        accounts=accounts,
        total_balance=total_balance,
        total_gain_loss=total_gain_loss,
        total_gain_loss_percent=total_gain_loss_percent,
        currency=currency,
    )
    _portfolio_cache[user_id] = (
        time.monotonic() + PORTFOLIO_CACHE_TTL_SECONDS,
        portfolio.model_copy(deep=True),
    )
    return portfolio
