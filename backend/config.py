"""Load configuration from environment and optional .env file."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (one level up) or current directory
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

# SnapTrade
SNAPTRADE_API_URL = os.getenv("SNAPTRADE_API_URL", "https://api.snaptrade.com/api/v1")
SNAPTRADE_CLIENT_ID = os.getenv("SNAPTRADE_CLIENT_ID", "")
SNAPTRADE_CONSUMER_KEY = os.getenv("SNAPTRADE_CONSUMER_KEY", "")

# Trading safety switch. Only "live" actually submits orders to the brokerage;
# any other value (default "test") simulates placement so local/dev never moves real money.
TRADING_MODE = (os.getenv("TRADING_MODE", "test") or "test").strip().lower()
TRADING_LIVE = TRADING_MODE == "live"

# Plaid
PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID", "")
PLAID_SECRET = os.getenv("PLAID_SECRET", "")
PLAID_ENV = "production" if (os.getenv("APP_ENV") or "").lower() == "production" else "sandbox"
PLAID_PRODUCTS = os.getenv("PLAID_PRODUCTS", "transactions")
PLAID_COUNTRY_CODES = "US"
PLAID_TOKEN_ENCRYPTION_KEY = os.getenv("PLAID_TOKEN_ENCRYPTION_KEY", "")
SNAPTRADE_SECRET_ENCRYPTION_KEY = os.getenv("SNAPTRADE_SECRET_ENCRYPTION_KEY", "")

# Twelve Data
TWELVE_DATA_API_URL = os.getenv("TWELVE_DATA_API_URL", "https://api.twelvedata.com")
TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "")
