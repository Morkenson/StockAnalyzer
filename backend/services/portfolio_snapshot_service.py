"""Daily portfolio balance snapshots."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from db_models import SnapTradePortfolioBalanceSnapshot
from models.snaptrade_models import Portfolio, PortfolioBalanceSnapshot


def save_daily_snapshot(db: Session, user_id: str, portfolio: Portfolio, snapshot_date: date | None = None) -> PortfolioBalanceSnapshot:
    target_date = snapshot_date or date.today()
    row = db.scalar(
        select(SnapTradePortfolioBalanceSnapshot).where(
            SnapTradePortfolioBalanceSnapshot.user_id == user_id,
            SnapTradePortfolioBalanceSnapshot.snapshot_date == target_date,
        )
    )
    if row is None:
        row = SnapTradePortfolioBalanceSnapshot(user_id=user_id, snapshot_date=target_date)
        db.add(row)

    row.total_balance = portfolio.total_balance or 0
    row.total_gain_loss = portfolio.total_gain_loss or 0
    row.total_gain_loss_percent = portfolio.total_gain_loss_percent or 0
    row.account_count = len(portfolio.accounts or [])
    row.currency = portfolio.currency or "USD"
    db.commit()
    db.refresh(row)
    return _snapshot_row(row)


def get_snapshots(db: Session, user_id: str) -> list[PortfolioBalanceSnapshot]:
    rows = db.scalars(
        select(SnapTradePortfolioBalanceSnapshot)
        .where(SnapTradePortfolioBalanceSnapshot.user_id == user_id)
        .order_by(SnapTradePortfolioBalanceSnapshot.snapshot_date.asc())
    ).all()
    return [_snapshot_row(row) for row in rows]


def _snapshot_row(row: SnapTradePortfolioBalanceSnapshot) -> PortfolioBalanceSnapshot:
    return PortfolioBalanceSnapshot(
        snapshot_date=row.snapshot_date,
        total_balance=float(row.total_balance or 0),
        total_gain_loss=float(row.total_gain_loss or 0),
        total_gain_loss_percent=float(row.total_gain_loss_percent or 0),
        account_count=row.account_count or 0,
        currency=row.currency or "USD",
    )
