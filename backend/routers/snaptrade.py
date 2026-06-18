"""SnapTrade API routes - user, connect, portfolio, accounts, brokerages."""
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from db_models import AppUser
from models.common import ApiResponse
from models.snaptrade_models import (
    AccountPreferenceUpdate,
    DividendFrequencyPreferenceUpdate,
    DividendPreferenceClearRequest,
    Portfolio,
    RecurringBuyScheduleCreate,
    RecurringBuyScheduleUpdate,
    RecurringInvestmentPreferenceUpdate,
    TradeOrderRequest,
)
from routers.persistence import _current_user
from services import account_preference_service as account_pref_svc
from services import dividend_preference_service as dividend_pref_svc
from services import portfolio_snapshot_service as portfolio_snapshot_svc
from services import recurring_buy_service as recurring_buy_svc
from services import recurring_preference_service as recurring_pref_svc
from services import snaptrade_service as snaptrade_svc
from services import user_service as user_svc

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/snaptrade", tags=["snaptrade"])


def _optional_current_user(request: Request, db: Session = Depends(get_db)) -> AppUser | None:
    try:
        return _current_user(request, db)
    except HTTPException:
        return None


def _get_user_id(request: Request, current_user: AppUser | None) -> str:
    if current_user is not None:
        return current_user.id
    raise HTTPException(status_code=401, detail="Authentication required")


def _is_invalid_secret_error(ex: "snaptrade_svc.SnapTradeServiceError") -> bool:
    """True when SnapTrade rejected the stored userId/userSecret (code 1083).

    Happens after the SnapTrade client credentials change — secrets registered under
    the previous client are no longer valid and the user must reconnect.
    """
    if getattr(ex, "code", None) == "1083":
        return True
    return "invalid userid or usersecret" in str(ex).lower()


async def _forget_invalid_secret(user_id: str) -> None:
    logger.warning("Clearing invalid SnapTrade secret for user %s; reconnect required", user_id)
    await user_svc.delete_user_secret(user_id)
    snaptrade_svc.clear_user_cache(user_id)


def _auth_error_response(ex: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=ex.status_code,
        content=ApiResponse(success=False, message=str(ex.detail)).model_dump(by_alias=True),
    )


async def _assert_account_owned_by_user(user_id: str, account_id: str) -> None:
    user_secret = await user_svc.get_user_secret(user_id)
    if not user_secret:
        raise HTTPException(status_code=404, detail="No SnapTrade connection found. Please connect your account first.")
    accounts = await snaptrade_svc.get_accounts(user_id, user_secret)
    if account_id not in {acc.id for acc in accounts}:
        raise HTTPException(status_code=403, detail="Account not found")


async def _assert_account_trading_enabled(user_id: str, account_id: str) -> None:
    """Reject if the connection can't place trades (read-only link / non-trade brokerage).

    Without this, a schedule would be created but every run fails with
    "User does not have permission to place orders".
    """
    user_secret = await user_svc.get_user_secret(user_id)
    if not user_secret:
        raise HTTPException(status_code=404, detail="No SnapTrade connection found. Please connect your account first.")
    accounts = await snaptrade_svc.get_accounts(user_id, user_secret)
    account = next((acc for acc in accounts if acc.id == account_id), None)
    if account is None:
        raise HTTPException(status_code=403, detail="Account not found")
    trading_map = await snaptrade_svc.get_account_trading_map(user_id, user_secret)
    if not trading_map.get(account.brokerage_id, False):
        raise HTTPException(
            status_code=400,
            detail="Trading isn't enabled for this connection. Reconnect the brokerage with trade permission to schedule buys.",
        )


def _portfolio_redirect_uri(request: Request) -> str:
    origin = request.headers.get("origin")
    if origin:
        return f"{origin.rstrip('/')}/portfolio"
    return f"{request.url.scheme}://{request.url.netloc}/api/snaptrade/callback"


async def _apply_account_preferences(user_id: str, portfolio: Portfolio) -> Portfolio:
    preferences = await account_pref_svc.get_preferences(user_id)
    visible_accounts = []
    for account in portfolio.accounts:
        preference = preferences.get(account.id, {})
        if preference.get("hidden"):
            continue
        nickname = preference.get("nickname")
        if isinstance(nickname, str) and nickname.strip():
            account.nickname = nickname.strip()
        margin_balance = preference.get("margin_balance")
        if isinstance(margin_balance, (int, float)):
            account.margin_balance = max(0, float(margin_balance))
        margin_interest_rate = preference.get("margin_interest_rate")
        if isinstance(margin_interest_rate, (int, float)):
            account.margin_interest_rate = max(0, float(margin_interest_rate))
        visible_accounts.append(account)

    portfolio.accounts = visible_accounts
    portfolio.total_balance = sum(account.balance or 0 for account in visible_accounts)
    portfolio.total_gain_loss = sum(sum(holding.gain_loss for holding in account.holdings) for account in visible_accounts)
    portfolio.total_gain_loss_percent = (
        (portfolio.total_gain_loss / (portfolio.total_balance - portfolio.total_gain_loss) * 100)
        if (portfolio.total_balance - portfolio.total_gain_loss)
        else 0
    )
    portfolio.currency = visible_accounts[0].currency if visible_accounts else portfolio.currency
    return portfolio


@router.post("/user")
async def create_user(request: Request, current_user: AppUser | None = Depends(_optional_current_user)):
    try:
        user_id = _get_user_id(request, current_user)
        snaptrade_user = await snaptrade_svc.create_user(user_id)
        if snaptrade_user.user_secret:
            await user_svc.store_user_secret(user_id, snaptrade_user.user_secret)
        return ApiResponse(success=True, message="User created successfully").model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error creating SnapTrade user")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.post("/connect/initiate")
async def initiate_connection(
    request: Request,
    trade: bool = False,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await user_svc.get_user_secret(user_id)
        if not user_secret:
            snaptrade_user = await snaptrade_svc.create_user(user_id)
            user_secret = snaptrade_user.user_secret
            if not user_secret:
                raise RuntimeError("SnapTrade did not return a user secret")
            await user_svc.store_user_secret(user_id, user_secret)
        redirect_uri = _portfolio_redirect_uri(request)
        connection_type = "trade" if trade else "read"
        logger.info(
            "initiating SnapTrade connection user=%s connection_type=%s redirect_uri=%s",
            user_id, connection_type, redirect_uri,
        )
        login_link = await snaptrade_svc.initiate_connection(
            user_id, user_secret, redirect_uri, connection_type=connection_type
        )
        if not login_link:
            return JSONResponse(
                status_code=400,
                content=ApiResponse(
                    success=False,
                    message="Failed to get redirect URL from SnapTrade",
                ).model_dump(by_alias=True),
            )
        return ApiResponse(success=True, data={"redirectUri": login_link}).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error initiating connection")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/portfolio")
async def get_portfolio(
    request: Request,
    refresh: bool = False,
    current_user: AppUser | None = Depends(_optional_current_user),
    db: Session = Depends(get_db),
):
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await user_svc.get_user_secret(user_id)
        if not user_secret:
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message="User not found. Please connect your account first.",
                ).model_dump(by_alias=True),
            )
        portfolio = await snaptrade_svc.get_portfolio(user_id, user_secret, force_refresh=refresh)
        portfolio = await _apply_account_preferences(user_id, portfolio)
        portfolio_snapshot_svc.save_daily_snapshot(db, user_id, portfolio)
        return ApiResponse(success=True, data=portfolio).model_dump(by_alias=True)
    except snaptrade_svc.SnapTradeServiceError as ex:
        logger.warning("SnapTrade portfolio request failed: %s", ex)
        if _is_invalid_secret_error(ex):
            await _forget_invalid_secret(user_id)
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message="Your brokerage connection is no longer valid (the SnapTrade account changed). Please reconnect.",
                ).model_dump(by_alias=True),
            )
        return JSONResponse(
            status_code=ex.status_code,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error fetching portfolio")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/portfolio/snapshots")
async def get_portfolio_snapshots(
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
    db: Session = Depends(get_db),
):
    try:
        user_id = _get_user_id(request, current_user)
        snapshots = portfolio_snapshot_svc.get_snapshots(db, user_id)
        return ApiResponse(success=True, data=snapshots).model_dump(by_alias=True)
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error fetching portfolio snapshots")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/portfolio/value-history")
async def get_portfolio_value_history(
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    """Portfolio value history straight from the brokerage (SnapTrade Pro), computed in
    memory. Read-only — this never touches our snapshot tables."""
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await user_svc.get_user_secret(user_id)
        if not user_secret:
            raise HTTPException(status_code=404, detail="No SnapTrade connection found. Please connect your account first.")
        accounts = await snaptrade_svc.get_accounts(user_id, user_secret)
        account_histories = []
        failures = []
        for account in accounts:
            try:
                points = await snaptrade_svc.get_account_balance_history(user_id, user_secret, account.id)
            except snaptrade_svc.SnapTradeServiceError as ex:
                logger.warning("balance history failed for account %s: %s", account.id, ex)
                failures.append(str(ex))
                continue
            if points:
                account_histories.append({
                    "account_id": account.id,
                    "account_name": account.nickname or account.name,
                    "currency": account.currency or "USD",
                    "points": points,
                })
        history = portfolio_snapshot_svc.build_value_history(account_histories)
        message = None
        if not history and failures:
            message = "Your plan may not include balance history: " + "; ".join(sorted(set(failures)))
        return ApiResponse(success=True, data=history, message=message).model_dump(by_alias=True)
    except snaptrade_svc.SnapTradeServiceError as ex:
        if _is_invalid_secret_error(ex):
            await _forget_invalid_secret(user_id)
            return JSONResponse(
                status_code=404,
                content=ApiResponse(success=False, message="Your brokerage connection is no longer valid. Please reconnect.").model_dump(by_alias=True),
            )
        return JSONResponse(status_code=ex.status_code, content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True))
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error fetching portfolio value history")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/accounts/{account_id}/snapshots")
async def get_account_snapshots(
    account_id: str,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
    db: Session = Depends(get_db),
):
    try:
        user_id = _get_user_id(request, current_user)
        snapshots = portfolio_snapshot_svc.get_account_snapshots(db, user_id, account_id)
        return ApiResponse(success=True, data=snapshots).model_dump(by_alias=True)
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error fetching account snapshots")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/accounts")
async def get_accounts(request: Request, current_user: AppUser | None = Depends(_optional_current_user)):
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await user_svc.get_user_secret(user_id)
        if not user_secret:
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message="User not found. Please connect your account first.",
                ).model_dump(by_alias=True),
            )
        accounts = await snaptrade_svc.get_accounts(user_id, user_secret)
        return ApiResponse(success=True, data=accounts).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error fetching accounts")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/recurring-investments")
async def get_recurring_investments(
    request: Request,
    refresh: bool = False,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await user_svc.get_user_secret(user_id)
        if not user_secret:
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message="No SnapTrade connection found. Please connect your account first.",
                ).model_dump(by_alias=True),
            )
        portfolio = await snaptrade_svc.get_portfolio(user_id, user_secret, force_refresh=refresh)
        visible_portfolio = await _apply_account_preferences(user_id, portfolio)
        recurring = await snaptrade_svc.get_recurring_investments(
            user_id,
            user_secret,
            accounts=visible_portfolio.accounts,
            force_refresh=refresh,
        )
        recurring_preferences = await recurring_pref_svc.get_preferences(user_id)
        recurring = recurring_pref_svc.apply_preferences(recurring, recurring_preferences)
        return ApiResponse(success=True, data=recurring).model_dump(by_alias=True)
    except snaptrade_svc.SnapTradeServiceError as ex:
        logger.warning("SnapTrade recurring investments request failed: %s", ex)
        return JSONResponse(
            status_code=ex.status_code,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error fetching recurring investments")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.patch("/recurring-investments/preferences")
async def update_recurring_investment_preference(
    payload: RecurringInvestmentPreferenceUpdate,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        await _assert_account_owned_by_user(user_id, payload.account_id)
        preference = await recurring_pref_svc.update_preference(
            user_id,
            payload.account_id,
            payload.symbol,
            currency=payload.currency,
            amount=payload.amount,
            frequency=payload.frequency,
            hidden=payload.hidden,
        )
        return ApiResponse(success=True, data=preference).model_dump(by_alias=True)
    except ValueError as ex:
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error updating recurring investment preference")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.delete("/recurring-investments/preferences")
async def hide_recurring_investment_preference(
    payload: RecurringInvestmentPreferenceUpdate,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        await _assert_account_owned_by_user(user_id, payload.account_id)
        preference = await recurring_pref_svc.update_preference(
            user_id,
            payload.account_id,
            payload.symbol,
            currency=payload.currency,
            hidden=True,
        )
        return ApiResponse(success=True, data=preference).model_dump(by_alias=True)
    except ValueError as ex:
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error hiding recurring investment preference")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.delete("/recurring-investments/preferences/accounts/{account_id}")
async def clear_recurring_investment_preferences(
    account_id: str,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        await _assert_account_owned_by_user(user_id, account_id)
        result = await recurring_pref_svc.clear_account_preferences(user_id, account_id)
        snaptrade_svc.clear_recurring_investments_cache(user_id)
        return ApiResponse(success=True, data=result).model_dump(by_alias=True)
    except ValueError as ex:
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error clearing recurring investment preferences")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/dividend-income")
async def get_dividend_income(
    request: Request,
    refresh: bool = False,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await user_svc.get_user_secret(user_id)
        if not user_secret:
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message="No SnapTrade connection found. Please connect your account first.",
                ).model_dump(by_alias=True),
            )
        portfolio = await snaptrade_svc.get_portfolio(user_id, user_secret, force_refresh=refresh)
        visible_portfolio = await _apply_account_preferences(user_id, portfolio)
        frequency_overrides = await dividend_pref_svc.get_preferences(user_id)
        dividend_income = await snaptrade_svc.get_dividend_income(
            user_id,
            user_secret,
            accounts=visible_portfolio.accounts,
            force_refresh=refresh,
            frequency_overrides=frequency_overrides,
        )
        return ApiResponse(success=True, data=dividend_income).model_dump(by_alias=True)
    except snaptrade_svc.SnapTradeServiceError as ex:
        logger.warning("SnapTrade dividend income request failed: %s", ex)
        return JSONResponse(
            status_code=ex.status_code,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error fetching dividend income")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.patch("/dividend-income/preferences")
async def update_dividend_income_preference(
    payload: DividendFrequencyPreferenceUpdate,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        if not payload.symbol.strip():
            raise ValueError("symbol is required")
        preference = await dividend_pref_svc.update_preference(
            user_id,
            payload.symbol,
            payload.payment_frequency,
            currency=payload.currency,
            hidden=payload.hidden,
        )
        snaptrade_svc.clear_user_cache(user_id)
        return ApiResponse(success=True, data=preference).model_dump(by_alias=True)
    except ValueError as ex:
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except Exception as ex:
        logger.exception("Error updating dividend income preference")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.delete("/dividend-income/preferences")
async def hide_dividend_income_preference(
    payload: DividendFrequencyPreferenceUpdate,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        if not payload.symbol.strip():
            raise ValueError("symbol is required")
        preference = await dividend_pref_svc.update_preference(
            user_id,
            payload.symbol,
            payload.payment_frequency or "annual",
            currency=payload.currency,
            hidden=True,
        )
        snaptrade_svc.clear_user_cache(user_id)
        return ApiResponse(success=True, data=preference).model_dump(by_alias=True)
    except ValueError as ex:
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except Exception as ex:
        logger.exception("Error hiding dividend income preference")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.delete("/dividend-income/preferences/symbols")
async def clear_dividend_income_preferences(
    payload: DividendPreferenceClearRequest,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        symbols = [
            {"symbol": item.symbol, "currency": item.currency}
            for item in payload.symbols
        ]
        result = await dividend_pref_svc.clear_preferences(user_id, symbols=symbols)
        snaptrade_svc.clear_user_cache(user_id)
        return ApiResponse(success=True, data=result).model_dump(by_alias=True)
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error clearing dividend income preferences")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.patch("/accounts/{account_id}/preference")
async def update_account_preference(
    account_id: str,
    payload: AccountPreferenceUpdate,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        await _assert_account_owned_by_user(user_id, account_id)
        preference = await account_pref_svc.update_preference(
            user_id,
            account_id,
            nickname=payload.nickname,
            margin_balance=payload.margin_balance,
            margin_interest_rate=payload.margin_interest_rate,
            hidden=payload.hidden,
        )
        snaptrade_svc.clear_user_cache(user_id)
        return ApiResponse(success=True, data=preference).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error updating account preference")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.delete("/accounts/{account_id}")
async def hide_account(
    account_id: str,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        await _assert_account_owned_by_user(user_id, account_id)
        preference = await account_pref_svc.hide_account(user_id, account_id)
        snaptrade_svc.clear_user_cache(user_id)
        return ApiResponse(success=True, data=preference).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error hiding account")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/accounts/{account_id}/holdings")
async def get_account_holdings(
    account_id: str,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await user_svc.get_user_secret(user_id)
        if not user_secret:
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message="User not found. Please connect your account first.",
                ).model_dump(by_alias=True),
            )
        holdings = await snaptrade_svc.get_account_holdings(user_id, user_secret, account_id)
        return ApiResponse(success=True, data=holdings).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error fetching holdings")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


async def _trading_context(user_id: str, account_id: str) -> str:
    """Assert the account belongs to the user and return the user secret."""
    user_secret = await user_svc.get_user_secret(user_id)
    if not user_secret:
        raise HTTPException(status_code=404, detail="No SnapTrade connection found. Please connect your account first.")
    accounts = await snaptrade_svc.get_accounts(user_id, user_secret)
    if account_id not in {acc.id for acc in accounts}:
        raise HTTPException(status_code=403, detail="Account not found")
    return user_secret


@router.post("/accounts/{account_id}/orders/impact")
async def check_order_impact(
    account_id: str,
    payload: TradeOrderRequest,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await _trading_context(user_id, account_id)
        if not payload.action or not payload.symbol:
            raise ValueError("action and symbol are required to check order impact")
        impact = await snaptrade_svc.check_order_impact(
            user_id,
            user_secret,
            account_id,
            payload.action,
            payload.symbol,
            order_type=payload.order_type,
            time_in_force=payload.time_in_force,
            units=payload.units,
            limit_price=payload.limit_price,
            stop_price=payload.stop_price,
            notional_value=payload.notional_value,
        )
        return ApiResponse(success=True, data=impact).model_dump(by_alias=True)
    except snaptrade_svc.SnapTradeServiceError as ex:
        return JSONResponse(
            status_code=ex.status_code,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error checking order impact")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.post("/accounts/{account_id}/orders")
async def place_order(
    account_id: str,
    payload: TradeOrderRequest,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await _trading_context(user_id, account_id)
        if payload.trade_id:
            execution = await snaptrade_svc.place_checked_order(
                user_id, user_secret, account_id, payload.trade_id
            )
            snaptrade_svc.clear_user_cache(user_id)
        else:
            if not payload.action or not payload.symbol:
                raise ValueError("action and symbol are required unless tradeId is provided")
            execution = await snaptrade_svc.place_order(
                user_id,
                user_secret,
                account_id,
                payload.action,
                payload.symbol,
                order_type=payload.order_type,
                time_in_force=payload.time_in_force,
                units=payload.units,
                limit_price=payload.limit_price,
                stop_price=payload.stop_price,
                notional_value=payload.notional_value,
            )
        return ApiResponse(success=True, data=execution, message="Order placed").model_dump(by_alias=True)
    except snaptrade_svc.SnapTradeServiceError as ex:
        return JSONResponse(
            status_code=ex.status_code,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error placing order")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.delete("/accounts/{account_id}/orders/{brokerage_order_id}")
async def cancel_order(
    account_id: str,
    brokerage_order_id: str,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        user_secret = await _trading_context(user_id, account_id)
        execution = await snaptrade_svc.cancel_order(
            user_id, user_secret, account_id, brokerage_order_id
        )
        return ApiResponse(success=True, data=execution, message="Order cancelled").model_dump(by_alias=True)
    except snaptrade_svc.SnapTradeServiceError as ex:
        return JSONResponse(
            status_code=ex.status_code,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error cancelling order")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/recurring-buys")
async def list_recurring_buys(
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        schedules = await recurring_buy_svc.list_schedules(user_id)
        return ApiResponse(success=True, data=schedules).model_dump(by_alias=True)
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error listing recurring buys")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.post("/recurring-buys")
async def create_recurring_buy(
    payload: RecurringBuyScheduleCreate,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        await _assert_account_trading_enabled(user_id, payload.account_id)
        schedule = await recurring_buy_svc.create_schedule(
            user_id,
            payload.account_id,
            payload.symbol,
            payload.frequency,
            units=payload.units,
            target_amount=payload.target_amount,
            start_date=payload.start_date,
        )
        return ApiResponse(success=True, data=schedule, message="Recurring buy created").model_dump(by_alias=True)
    except ValueError as ex:
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error creating recurring buy")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.patch("/recurring-buys/{schedule_id}")
async def update_recurring_buy(
    schedule_id: str,
    payload: RecurringBuyScheduleUpdate,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        schedule = await recurring_buy_svc.update_schedule(
            user_id,
            schedule_id,
            units=payload.units,
            target_amount=payload.target_amount,
            frequency=payload.frequency,
            next_run_date=payload.next_run_date,
            active=payload.active,
        )
        return ApiResponse(success=True, data=schedule).model_dump(by_alias=True)
    except ValueError as ex:
        status = 404 if "not found" in str(ex).lower() else 400
        return JSONResponse(
            status_code=status,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error updating recurring buy")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.delete("/recurring-buys/{schedule_id}")
async def delete_recurring_buy(
    schedule_id: str,
    request: Request,
    current_user: AppUser | None = Depends(_optional_current_user),
):
    try:
        user_id = _get_user_id(request, current_user)
        result = await recurring_buy_svc.delete_schedule(user_id, schedule_id)
        return ApiResponse(success=True, data=result, message="Recurring buy removed").model_dump(by_alias=True)
    except ValueError as ex:
        return JSONResponse(
            status_code=404,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except HTTPException as ex:
        return _auth_error_response(ex)
    except Exception as ex:
        logger.exception("Error deleting recurring buy")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/brokerages")
async def get_brokerages():
    try:
        brokerages = await snaptrade_svc.get_brokerages()
        return ApiResponse(success=True, data=brokerages).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error fetching brokerages")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/callback")
async def oauth_callback(code: str | None = None, state: str | None = None):
    target = os.getenv("SNAPTRADE_CALLBACK_REDIRECT", "http://localhost:4200/portfolio")
    return RedirectResponse(url=target)
