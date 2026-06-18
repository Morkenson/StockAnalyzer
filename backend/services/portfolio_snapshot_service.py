"""Daily portfolio balance snapshots."""
import bisect
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


def build_value_history(account_histories: list[dict]) -> list[PortfolioBalanceSnapshot]:
    """Build portfolio value history from brokerage data, IN MEMORY — no DB writes.

    ``account_histories`` is a list of
    ``{"account_id", "account_name", "currency", "points": [{"date", "total_value"}]}``
    (from SnapTrade's balance-history endpoint). The portfolio total for each date is the
    sum across accounts of each account's most recent value on/before that date
    (forward-fill), so accounts with sparser history still total correctly. Returns
    ascending-by-date ``PortfolioBalanceSnapshot`` points (gain/loss is 0 — the brokerage
    endpoint only reports value).
    """
    series: list[dict] = []
    all_dates: set[date] = set()
    for entry in account_histories:
        points = sorted(
            ((p["date"], float(p["total_value"])) for p in entry.get("points", []) if p.get("date")),
            key=lambda x: x[0],
        )
        if not points:
            continue
        series.append({**entry, "points": points, "dates": [p[0] for p in points]})
        all_dates.update(d for d, _ in points)

    if not all_dates:
        return []

    currency = next((e.get("currency") for e in series if e.get("currency")), "USD")
    history: list[PortfolioBalanceSnapshot] = []
    for d in sorted(all_dates):
        total = 0.0
        account_count = 0
        for entry in series:
            idx = bisect.bisect_right(entry["dates"], d) - 1  # latest point on/before d
            if idx < 0:
                continue  # account had no value yet on this date
            total += entry["points"][idx][1]
            account_count += 1
        history.append(
            PortfolioBalanceSnapshot(
                snapshot_date=d,
                total_balance=total,
                total_gain_loss=0,
                total_gain_loss_percent=0,
                account_count=account_count,
                currency=currency,
            )
        )
    return history


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
