"""Daily portfolio balance snapshots."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from db_models import SnapTradeAccountBalanceSnapshot, SnapTradePortfolioBalanceSnapshot
from models.snaptrade_models import Account, AccountBalanceSnapshot, Portfolio, PortfolioBalanceSnapshot


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

    for account in portfolio.accounts or []:
        _save_account_snapshot(db, user_id, account, target_date)

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


def get_account_snapshots(db: Session, user_id: str, account_id: str) -> list[AccountBalanceSnapshot]:
    rows = db.scalars(
        select(SnapTradeAccountBalanceSnapshot)
        .where(
            SnapTradeAccountBalanceSnapshot.user_id == user_id,
            SnapTradeAccountBalanceSnapshot.account_id == account_id,
        )
        .order_by(SnapTradeAccountBalanceSnapshot.snapshot_date.asc())
    ).all()
    return [_account_snapshot_row(row) for row in rows]


def _save_account_snapshot(db: Session, user_id: str, account: Account, snapshot_date: date) -> SnapTradeAccountBalanceSnapshot:
    row = db.scalar(
        select(SnapTradeAccountBalanceSnapshot).where(
            SnapTradeAccountBalanceSnapshot.user_id == user_id,
            SnapTradeAccountBalanceSnapshot.account_id == account.id,
            SnapTradeAccountBalanceSnapshot.snapshot_date == snapshot_date,
        )
    )
    if row is None:
        row = SnapTradeAccountBalanceSnapshot(user_id=user_id, account_id=account.id, snapshot_date=snapshot_date)
        db.add(row)

    total_balance = account.balance
    if total_balance is None:
        total_balance = sum(holding.total_value for holding in account.holdings or [])
    total_gain_loss = sum(holding.gain_loss for holding in account.holdings or [])
    basis = (total_balance or 0) - total_gain_loss

    row.account_name = account.nickname or account.name
    row.total_balance = total_balance or 0
    row.total_gain_loss = total_gain_loss
    row.total_gain_loss_percent = (total_gain_loss / basis * 100) if basis else 0
    row.holding_count = len(account.holdings or [])
    row.currency = account.currency or "USD"
    return row


def _snapshot_row(row: SnapTradePortfolioBalanceSnapshot) -> PortfolioBalanceSnapshot:
    return PortfolioBalanceSnapshot(
        snapshot_date=row.snapshot_date,
        total_balance=float(row.total_balance or 0),
        total_gain_loss=float(row.total_gain_loss or 0),
        total_gain_loss_percent=float(row.total_gain_loss_percent or 0),
        account_count=row.account_count or 0,
        currency=row.currency or "USD",
    )


def _account_snapshot_row(row: SnapTradeAccountBalanceSnapshot) -> AccountBalanceSnapshot:
    return AccountBalanceSnapshot(
        snapshot_date=row.snapshot_date,
        account_id=row.account_id,
        account_name=row.account_name,
        total_balance=float(row.total_balance or 0),
        total_gain_loss=float(row.total_gain_loss or 0),
        total_gain_loss_percent=float(row.total_gain_loss_percent or 0),
        holding_count=row.holding_count or 0,
        currency=row.currency or "USD",
    )
