"""
Mork Wealth API - Python FastAPI backend.
Replacement for the C# backend; same routes and response shape for the Angular frontend.
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


REQUIRED_PROD_ENV_VARS = (
    "JWT_SECRET",
    "PLAID_TOKEN_ENCRYPTION_KEY",
    "SNAPTRADE_SECRET_ENCRYPTION_KEY",
    "FRONTEND_ORIGINS",
    "SNAPTRADE_CALLBACK_REDIRECT",
    "DATABASE_URL",
)

REQUIRED_PROD_ENV_VALUES = {
    "COOKIE_SECURE": "true",
}

FORBIDDEN_PROD_ENV_VARS = ("DEBUG_EXPOSE_RESET_TOKEN",)

OPTIONAL_ENV_VARS = (
    "SNAPTRADE_CLIENT_ID",
    "SNAPTRADE_CONSUMER_KEY",
    "PLAID_CLIENT_ID",
    "PLAID_SECRET",
    "TWELVE_DATA_API_KEY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "COOKIE_SECURE",
    "COOKIE_SAMESITE",
    "FRONTEND_ORIGINS",
    "SNAPTRADE_CALLBACK_REDIRECT",
    "CORS_ORIGIN_REGEX",
    "DATABASE_URL",
    "PLAID_TOKEN_ENCRYPTION_KEY",
    "SNAPTRADE_SECRET_ENCRYPTION_KEY",
    "JWT_SECRET",
)


def _log_optional_env_vars() -> None:
    unset = [name for name in OPTIONAL_ENV_VARS if not os.getenv(name)]
    if unset:
        logger.warning("env vars not set (features may be disabled or running with defaults): %s", ", ".join(unset))
    else:
        logger.info("all known env vars are set")


def _validate_production_env() -> None:
    app_env = (os.getenv("APP_ENV") or "").lower()
    if not app_env:
        raise RuntimeError(
            "APP_ENV must be set explicitly (e.g. 'production' or 'development'). Refusing to start."
        )
    if app_env not in {"production", "development", "test"}:
        raise RuntimeError(
            f"APP_ENV={app_env!r} is not a recognized value. Use 'production', 'development', or 'test'."
        )
    if app_env != "production":
        return
    missing = [name for name in REQUIRED_PROD_ENV_VARS if not os.getenv(name)]
    misconfigured = [
        f"{name}={os.getenv(name)!r} (expected {expected!r})"
        for name, expected in REQUIRED_PROD_ENV_VALUES.items()
        if (os.getenv(name) or "").lower() != expected
    ]
    forbidden = [name for name in FORBIDDEN_PROD_ENV_VARS if os.getenv(name)]
    problems = []
    if missing:
        problems.append("missing required env vars: " + ", ".join(missing))
    if misconfigured:
        problems.append("misconfigured env vars: " + "; ".join(misconfigured))
    if forbidden:
        problems.append("forbidden env vars set in production: " + ", ".join(forbidden))
    jwt_secret = os.getenv("JWT_SECRET")
    for shared in ("PLAID_TOKEN_ENCRYPTION_KEY", "SNAPTRADE_SECRET_ENCRYPTION_KEY"):
        if jwt_secret and os.getenv(shared) == jwt_secret:
            problems.append(f"{shared} must not be equal to JWT_SECRET")
    if problems:
        raise RuntimeError("Production startup aborted — " + " | ".join(problems))


_validate_production_env()
_log_optional_env_vars()

from database import SessionLocal, init_db
from routers import cashflow, persistence, plaid, stock, snaptrade
from services import account_preference_service as account_pref_svc
from services import portfolio_snapshot_service as portfolio_snapshot_svc
from services import snaptrade_service as snaptrade_svc
from services import user_service as user_svc
DB_KEEPALIVE_INTERVAL_SECONDS = 86400
PORTFOLIO_SNAPSHOT_INTERVAL_SECONDS = 86400
DEFAULT_FRONTEND_ORIGINS = [
    "http://localhost:4200",
    "https://localhost:4200",
    "https://mork-wealth.zachary-mork-portfolio.dev",
]
DEFAULT_CORS_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"


def _frontend_origins() -> list[str]:
    origins = list(DEFAULT_FRONTEND_ORIGINS)
    configured = os.getenv("FRONTEND_ORIGINS", "")
    origins.extend(origin.strip() for origin in configured.split(",") if origin.strip())
    return sorted(set(origins))


def ping_database() -> None:
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))


async def database_keepalive_loop() -> None:
    while True:
        try:
            ping_database()
            logger.info("database keepalive ping succeeded")
        except Exception as exc:
            logger.warning("database keepalive ping failed: %s", exc)
        await asyncio.sleep(DB_KEEPALIVE_INTERVAL_SECONDS)


async def portfolio_snapshot_loop() -> None:
    while True:
        try:
            await snapshot_all_portfolios()
        except Exception as exc:
            logger.warning("portfolio snapshot pass failed: %s", exc)
        await asyncio.sleep(PORTFOLIO_SNAPSHOT_INTERVAL_SECONDS)


async def snapshot_all_portfolios() -> None:
    user_secrets = await user_svc.list_user_secrets()
    if not user_secrets:
        logger.info("portfolio snapshot pass skipped; no SnapTrade users found")
        return

    saved = 0
    for user_id, user_secret in user_secrets.items():
        try:
            portfolio = await snaptrade_svc.get_portfolio(user_id, user_secret, force_refresh=True)
            portfolio = await _visible_snapshot_portfolio(user_id, portfolio)
            with SessionLocal() as db:
                portfolio_snapshot_svc.save_daily_snapshot(db, user_id, portfolio)
            saved += 1
        except Exception as exc:
            logger.warning("portfolio snapshot failed for user %s: %s", user_id, exc)
    logger.info("portfolio snapshot pass saved %s/%s snapshots", saved, len(user_secrets))


async def _visible_snapshot_portfolio(user_id: str, portfolio):
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    keepalive_task = asyncio.create_task(database_keepalive_loop())
    snapshot_task = None
    if (os.getenv("APP_ENV") or "").lower() != "test":
        snapshot_task = asyncio.create_task(portfolio_snapshot_loop())
    try:
        yield
    finally:
        keepalive_task.cancel()
        if snapshot_task:
            snapshot_task.cancel()
        try:
            await keepalive_task
        except asyncio.CancelledError:
            pass
        if snapshot_task:
            try:
                await snapshot_task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="Mork Wealth API",
    description="Stock data and SnapTrade integration",
    version="1.0.0",
    lifespan=lifespan,
)

@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    tb = traceback.format_exc()
    print(f"UNHANDLED EXCEPTION {request.method} {request.url.path}\n{tb}", flush=True)
    logger.error("Unhandled exception %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


def _cors_middleware(app):
    return CORSMiddleware(
        app=app,
        allow_origins=_frontend_origins(),
        allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", DEFAULT_CORS_ORIGIN_REGEX),
        allow_credentials=True,
        allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin"],
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    )


# Mount under /api so frontend baseUrl http://localhost:5000/api works
app.include_router(stock.router, prefix="/api")
app.include_router(snaptrade.router, prefix="/api")
app.include_router(persistence.router, prefix="/api")
app.include_router(plaid.router, prefix="/api")
app.include_router(cashflow.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Mork Wealth API", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/keepalive")
async def keepalive():
    try:
        ping_database()
        return {"status": "ok", "database": "reachable"}
    except Exception as exc:
        logger.warning("manual database keepalive failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "message": "Database keepalive failed",
                "detail": str(exc),
            },
        )


@app.get("/api/cors-debug")
async def cors_debug():
    return {"allowedOrigins": _frontend_origins()}


_fastapi_app = app
app = _cors_middleware(_fastapi_app)
app.dependency_overrides = _fastapi_app.dependency_overrides


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV", "development") == "development",
    )
