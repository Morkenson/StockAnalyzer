import os
import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent
_test_db = _backend_dir / "test_stockanalyzer.db"
_test_db.unlink(missing_ok=True)

os.environ.setdefault("JWT_SECRET", "test-secret-for-testing-only")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_test_db.as_posix()}")
os.environ.setdefault("PLAID_TOKEN_ENCRYPTION_KEY", "test-plaid-token-encryption-key")
os.environ.setdefault("SNAPTRADE_SECRET_ENCRYPTION_KEY", "test-snaptrade-secret-encryption-key")
os.environ.setdefault("DEBUG_EXPOSE_RESET_TOKEN", "1")

# Ensure backend root is on path when running pytest from backend/ or project root
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete as sql_delete

import db_models
from main import app
from database import SessionLocal, init_db
from routers import persistence
from services import (
    account_preference_service,
    dividend_preference_service,
    recurring_preference_service,
    snaptrade_service,
    user_service,
)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clear_user_secrets():
    init_db()
    with SessionLocal() as db:
        for model in (
            db_models.CashflowEntry,
            db_models.PlaidAccount,
            db_models.PlaidItem,
            db_models.PasswordResetToken,
            db_models.SigninOtp,
            db_models.Loan,
            db_models.Asset,
            db_models.WatchlistItem,
            db_models.Watchlist,
            db_models.SnapTradeUserSecret,
            db_models.SnapTradeAccountPreference,
            db_models.SnapTradeDividendPreference,
            db_models.SnapTradeRecurringInvestmentPreference,
            db_models.SnapTradePortfolioBalanceSnapshot,
            db_models.AppUser,
        ):
            db.execute(sql_delete(model))
        db.commit()
    user_service._user_secrets.clear()
    account_preference_service._preferences.clear()
    dividend_preference_service._preferences.clear()
    recurring_preference_service._preferences.clear()
    snaptrade_service._portfolio_cache.clear()
    snaptrade_service._recurring_cache.clear()
    snaptrade_service._dividend_income_cache.clear()
    persistence._rate_buckets.clear()
    yield
    user_service._user_secrets.clear()
    account_preference_service._preferences.clear()
    dividend_preference_service._preferences.clear()
    recurring_preference_service._preferences.clear()
    snaptrade_service._portfolio_cache.clear()
    snaptrade_service._recurring_cache.clear()
    snaptrade_service._dividend_income_cache.clear()
    persistence._rate_buckets.clear()
