"""SnapTrade API routes - user, connect, portfolio, accounts, brokerages."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from db_models import AppUser
from models.common import ApiResponse
from models.snaptrade_models import AccountPreferenceUpdate, Portfolio
from routers.persistence import _current_user
from services import account_preference_service as account_pref_svc
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
    return request.headers.get("X-User-Id") or (current_user.id if current_user else "user123")


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
async def initiate_connection(request: Request, current_user: AppUser | None = Depends(_optional_current_user)):
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
        login_link = await snaptrade_svc.initiate_connection(user_id, user_secret, redirect_uri)
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
        return ApiResponse(success=True, data=portfolio).model_dump(by_alias=True)
    except snaptrade_svc.SnapTradeServiceError as ex:
        logger.warning("SnapTrade portfolio request failed: %s", ex)
        return JSONResponse(
            status_code=ex.status_code,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except Exception as ex:
        logger.exception("Error fetching portfolio")
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
        accounts = await snaptrade_svc.get_accounts(user_id, user_secret)
        visible_portfolio = await _apply_account_preferences(user_id, Portfolio(user_id=user_id, accounts=accounts))
        recurring = await snaptrade_svc.get_recurring_investments(
            user_id,
            user_secret,
            accounts=visible_portfolio.accounts,
            force_refresh=refresh,
        )
        return ApiResponse(success=True, data=recurring).model_dump(by_alias=True)
    except snaptrade_svc.SnapTradeServiceError as ex:
        logger.warning("SnapTrade recurring investments request failed: %s", ex)
        return JSONResponse(
            status_code=ex.status_code,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
    except Exception as ex:
        logger.exception("Error fetching recurring investments")
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
        preference = await account_pref_svc.update_preference(
            user_id,
            account_id,
            nickname=payload.nickname,
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
    return RedirectResponse(url="http://localhost:4200/portfolio")
