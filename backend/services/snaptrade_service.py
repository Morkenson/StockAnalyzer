"""SnapTrade API client for broker linking and portfolio data."""
import asyncio
import logging

from snaptrade_client import SnapTrade

from config import SNAPTRADE_API_URL, SNAPTRADE_CLIENT_ID, SNAPTRADE_CONSUMER_KEY
from models.snaptrade_models import Account, Brokerage, Holding, Portfolio, SnapTradeUser

logger = logging.getLogger(__name__)

def _sdk_client() -> SnapTrade:
    if not SNAPTRADE_CLIENT_ID or not SNAPTRADE_CONSUMER_KEY:
        raise RuntimeError("SnapTrade credentials are not configured")
    return SnapTrade(
        host=SNAPTRADE_API_URL.rstrip("/"),
        client_id=SNAPTRADE_CLIENT_ID,
        consumer_key=SNAPTRADE_CONSUMER_KEY,
    )


def _sdk_body(response):
    body = getattr(response, "body", response)
    if hasattr(body, "to_dict"):
        return body.to_dict()
    return body


async def create_user(user_id: str) -> SnapTradeUser:
    result = _sdk_body(await _sdk_client().authentication.aregister_snap_trade_user(body={"userId": user_id}))
    return SnapTradeUser(
        id=result.get("id", "") or result.get("userId", ""),
        user_id=result.get("userId", user_id),
        user_secret=result.get("userSecret"),
        email=result.get("email"),
        created_at=result.get("createdAt"),
    )


async def get_brokerages() -> list[Brokerage]:
    result = _sdk_body(await _sdk_client().reference_data.alist_all_brokerages())
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
        await _sdk_client().authentication.alogin_snap_trade_user(
            query_params={"userId": user_id, "userSecret": user_secret},
            custom_redirect=redirect_uri,
            immediate_redirect=True,
            show_close_button=False,
            connection_portal_version="v4",
        )
    )
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


async def get_accounts(user_id: str, user_secret: str) -> list[Account]:
    result = _sdk_body(
        await _sdk_client().account_information.alist_user_accounts(
            query_params={"userId": user_id, "userSecret": user_secret},
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
        await _sdk_client().account_information.aget_user_holdings(
            account_id=account_id,
            query_params={"userId": user_id, "userSecret": user_secret},
        )
    )
    holdings = []
    raw_holdings = result if isinstance(result, list) else result.get("holdings", []) or result.get("positions", [])
    for elem in raw_holdings:
        holdings.append(_parse_holding(elem))
    return holdings


async def get_portfolio(user_id: str, user_secret: str) -> Portfolio:
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
    return Portfolio(
        user_id=user_id,
        accounts=accounts,
        total_balance=total_balance,
        total_gain_loss=total_gain_loss,
        total_gain_loss_percent=total_gain_loss_percent,
        currency=currency,
    )
