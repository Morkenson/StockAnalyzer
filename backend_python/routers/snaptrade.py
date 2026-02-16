"""SnapTrade API routes - user, connect, portfolio, accounts, brokerages."""
import logging
from typing import Annotated

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse, RedirectResponse

from models.common import ApiResponse
from models.snaptrade_models import Account, Portfolio
from services import snaptrade_service as snaptrade_svc
from services import user_service as user_svc

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/snaptrade", tags=["snaptrade"])


def _get_user_id(request: Request, x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None) -> str:
    return (x_user_id or request.headers.get("X-User-Id")) or "user123"


@router.post("/user")
async def create_user(request: Request):
    try:
        user_id = _get_user_id(request)
        await snaptrade_svc.create_user(user_id)
        return ApiResponse(success=True, message="User created successfully").model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error creating SnapTrade user")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.post("/connect/initiate")
async def initiate_connection(request: Request):
    try:
        user_id = _get_user_id(request)
        user_secret = await user_svc.get_user_secret(user_id)
        if not user_secret:
            await snaptrade_svc.create_user(user_id)
            user_secret = "temp_secret"
            await user_svc.store_user_secret(user_id, user_secret)
        redirect_uri = f"{request.url.scheme}://{request.url.netloc}/api/snaptrade/callback"
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
async def get_portfolio(request: Request):
    try:
        user_id = _get_user_id(request)
        user_secret = await user_svc.get_user_secret(user_id)
        if not user_secret:
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message="User not found. Please connect your account first.",
                ).model_dump(by_alias=True),
            )
        portfolio = await snaptrade_svc.get_portfolio(user_id, user_secret)
        return ApiResponse(success=True, data=portfolio).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error fetching portfolio")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/accounts")
async def get_accounts(request: Request):
    try:
        user_id = _get_user_id(request)
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


@router.get("/accounts/{account_id}/holdings")
async def get_account_holdings(account_id: str, request: Request):
    try:
        user_id = _get_user_id(request)
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
