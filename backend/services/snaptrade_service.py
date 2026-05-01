"""SnapTrade API client for broker linking and portfolio data."""
import logging

import httpx

from config import SNAPTRADE_API_URL, SNAPTRADE_CLIENT_ID, SNAPTRADE_CONSUMER_KEY
from models.snaptrade_models import Account, Brokerage, Holding, Portfolio, SnapTradeUser

logger = logging.getLogger(__name__)

_headers = {
    "X-API-Key": SNAPTRADE_CLIENT_ID,
    "X-Consumer-Key": SNAPTRADE_CONSUMER_KEY,
    "Content-Type": "application/json",
}


async def _aget(path: str, params: dict | None = None) -> dict:
    url = f"{SNAPTRADE_API_URL.rstrip('/')}{path}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_headers, params=params, timeout=30.0)
        resp.raise_for_status()
        return resp.json()


async def _apost(path: str, json: dict) -> dict:
    url = f"{SNAPTRADE_API_URL.rstrip('/')}{path}"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_headers, json=json, timeout=30.0)
        resp.raise_for_status()
        return resp.json()


async def create_user(user_id: str) -> SnapTradeUser:
    result = await _apost("/snapTrade/v1/register", {"userId": user_id})
    return SnapTradeUser(
        id=result.get("id", ""),
        user_id=user_id,
        email=result.get("email"),
        created_at=result.get("createdAt"),
    )


async def get_brokerages() -> list[Brokerage]:
    result = await _aget("/snapTrade/v1/brokerages")
    brokerages = []
    for b in result.get("brokerages", []):
        brokerages.append(
            Brokerage(
                id=b.get("id", ""),
                name=b.get("name", ""),
                display_name=b.get("displayName"),
                supports_oauth=b.get("supportsOAuth", False),
            )
        )
    return brokerages


async def initiate_connection(user_id: str, user_secret: str, redirect_uri: str) -> str:
    result = await _apost(
        "/snapTrade/v1/auth/login",
        {"userId": user_id, "userSecret": user_secret, "redirectUri": redirect_uri},
    )
    return result.get("loginLink") or result.get("redirectUri") or ""


def _parse_account(element: dict) -> Account:
    return Account(
        id=element.get("id", ""),
        name=element.get("name", ""),
        account_number=element.get("accountNumber", ""),
        type=element.get("type", ""),
        brokerage_id=element.get("brokerageId", ""),
        balance=element.get("balance"),
        currency=element.get("currency", "USD"),
    )


def _parse_holding(element: dict) -> Holding:
    qty = float(element.get("quantity", 0) or 0)
    avg = float(element.get("averagePurchasePrice", 0) or 0)
    curr = float(element.get("currentPrice", 0) or 0)
    total = float(element.get("totalValue", 0) or (qty * curr))
    gain_loss = total - (qty * avg)
    gain_pct = (gain_loss / (qty * avg) * 100) if (qty * avg) else 0
    return Holding(
        symbol=element.get("symbol", ""),
        quantity=qty,
        average_purchase_price=avg,
        current_price=curr,
        total_value=total,
        gain_loss=gain_loss,
        gain_loss_percent=gain_pct,
        currency=element.get("currency", "USD"),
    )


async def get_accounts(user_id: str, user_secret: str) -> list[Account]:
    result = await _aget(
        "/snapTrade/v1/accounts",
        {"userId": user_id, "userSecret": user_secret},
    )
    accounts = []
    raw = result.get("accounts")
    if isinstance(raw, list):
        for acc in raw:
            accounts.append(_parse_account(acc))
    elif isinstance(result, list):
        for acc in result:
            accounts.append(_parse_account(acc))
    return accounts


async def get_account_holdings(
    user_id: str, user_secret: str, account_id: str
) -> list[Holding]:
    result = await _aget(
        f"/snapTrade/v1/accounts/{account_id}/holdings",
        {"userId": user_id, "userSecret": user_secret},
    )
    holdings = []
    for elem in result.get("holdings", []) or result.get("positions", []):
        holdings.append(_parse_holding(elem))
    return holdings


async def get_portfolio(user_id: str, user_secret: str) -> Portfolio:
    accounts = await get_accounts(user_id, user_secret)
    for acc in accounts:
        acc.holdings = await get_account_holdings(user_id, user_secret, acc.id)
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
