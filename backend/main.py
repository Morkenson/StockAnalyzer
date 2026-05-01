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

from database import SessionLocal, init_db
from routers import persistence, stock, snaptrade

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
DB_KEEPALIVE_INTERVAL_SECONDS = 86400


def _frontend_origins() -> list[str]:
    origins = [
        "http://localhost:4200",
        "https://localhost:4200",
        "https://mork-wealth.zachary-mork-portfolio.dev",
    ]
    configured = os.getenv("FRONTEND_ORIGINS", "")
    origins.extend(origin.strip() for origin in configured.split(",") if origin.strip())
    return origins


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
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app|https://.*\.zachary-mork-portfolio\.dev",
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
)

# Mount under /api so frontend baseUrl http://localhost:5000/api works
app.include_router(stock.router, prefix="/api")
app.include_router(snaptrade.router, prefix="/api")
app.include_router(persistence.router, prefix="/api")


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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV", "development") == "development",
    )
