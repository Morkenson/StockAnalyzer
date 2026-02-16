"""
StockAnalyzer API - Python FastAPI backend.
Replacement for the C# backend; same routes and response shape for the Angular frontend.
"""
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV", "development") == "development",
    )
