"""
Mork Wealth API - Python FastAPI backend.
Replacement for the C# backend; same routes and response shape for the Angular frontend.
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
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
DB_KEEPALIVE_INTERVAL_SECONDS = 86400
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    keepalive_task = asyncio.create_task(database_keepalive_loop())
    try:
        yield
    finally:
        keepalive_task.cancel()
        try:
            await keepalive_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Mork Wealth API",
    description="Stock data and SnapTrade integration",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for Angular frontend (match C# backend behavior)
app.add_middleware(
    CORSMiddleware,
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV", "development") == "development",
    )
