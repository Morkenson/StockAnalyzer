"""
StockAnalyzer API - Python FastAPI backend.
Replacement for the C# backend; same routes and response shape for the Angular frontend.
"""
import logging
import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path

from config import SUPABASE_ANON_KEY, SUPABASE_URL
from routers import stock, snaptrade

# Load .env from project root or current dir
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="StockAnalyzer API",
    description="Stock data and SnapTrade integration",
    version="1.0.0",
)

# CORS for Angular frontend (match C# backend behavior)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "https://localhost:4200",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|.*\.vercel\.app",
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
)

# Mount under /api so frontend baseUrl http://localhost:5000/api works
app.include_router(stock.router, prefix="/api")
app.include_router(snaptrade.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "StockAnalyzer API", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/keepalive")
async def keepalive():
    """Ping Supabase to keep free-tier project active. Call once per day via cron-job.org or UptimeRobot."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        logger.warning("keepalive: SUPABASE_URL or SUPABASE_ANON_KEY not set")
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "message": "Supabase keepalive not configured (missing SUPABASE_URL or SUPABASE_ANON_KEY)",
            },
        )
    url = f"{SUPABASE_URL}/rest/v1/"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
        # Any response from Supabase means the project is reachable
        return {"status": "ok", "supabase": "reachable"}
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.warning("keepalive: Supabase ping failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": "Supabase unreachable", "detail": str(e)},
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
