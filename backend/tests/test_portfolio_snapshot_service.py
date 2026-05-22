from datetime import date

from database import SessionLocal
from models.snaptrade_models import Account, Portfolio
from services import portfolio_snapshot_service as svc


def test_save_daily_snapshot_upserts_user_date():
    portfolio = Portfolio(
        user_id="user1",
        accounts=[Account(id="acc1", name="Brokerage", balance=100, currency="USD")],
        total_balance=100,
        total_gain_loss=5,
        total_gain_loss_percent=5.26,
        currency="USD",
    )

    with SessionLocal() as db:
        first = svc.save_daily_snapshot(db, "user1", portfolio, snapshot_date=date(2026, 5, 10))
        portfolio.total_balance = 125
        second = svc.save_daily_snapshot(db, "user1", portfolio, snapshot_date=date(2026, 5, 10))
        snapshots = svc.get_snapshots(db, "user1")

    assert first.snapshot_date == date(2026, 5, 10)
    assert second.total_balance == 125
    assert len(snapshots) == 1
    assert snapshots[0].total_balance == 125
    assert snapshots[0].account_count == 1
