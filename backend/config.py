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

# Twelve Data
TWELVE_DATA_API_URL = os.getenv("TWELVE_DATA_API_URL", "https://api.twelvedata.com")
TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "")
