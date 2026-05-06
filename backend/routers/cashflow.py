"""Cashflow entries for manual and Plaid-imported income/expenses."""
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from db_models import AppUser, CashflowEntry
from models.cashflow_models import CashflowEntryCreate, CashflowEntryUpdate
from models.common import ApiResponse
from routers.persistence import _current_user

router = APIRouter(prefix="/cashflow", tags=["cashflow"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _number(value) -> float:
    return float(value) if isinstance(value, Decimal) else value


def _entry_row(entry: CashflowEntry) -> dict:
    return {
        "id": entry.id,
        "source": entry.source,
        "type": entry.type,
        "name": entry.name,
        "merchantName": entry.merchant_name,
        "category": entry.category,
        "amount": _number(entry.amount),
        "date": entry.date.isoformat(),
        "plaidAccountId": entry.plaid_account_id,
        "plaidTransactionId": entry.plaid_transaction_id,
        "pending": entry.pending,
        "createdAt": entry.created_at.isoformat(),
        "updatedAt": entry.updated_at.isoformat(),
    }


def _month_bounds(month: str) -> tuple[date, date]:
    try:
        year, month_number = [int(part) for part in month.split("-", 1)]
        start = date(year, month_number, 1)
        if month_number == 12:
            end = date(year + 1, 1, 1)
        else:
            end = date(year, month_number + 1, 1)
        return start, end
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="month must use YYYY-MM format")


def _validate_type(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in {"income", "expense"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="type must be income or expense")
    return normalized


@router.get("/entries")
async def get_entries(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    start, end = _month_bounds(month)
    entries = db.scalars(
        select(CashflowEntry)
        .where(
            CashflowEntry.user_id == user.id,
            CashflowEntry.removed_at.is_(None),
            CashflowEntry.date >= start,
            CashflowEntry.date < end,
        )
        .order_by(CashflowEntry.date.desc(), CashflowEntry.created_at.desc())
    ).all()
    return ApiResponse(success=True, data=[_entry_row(entry) for entry in entries]).model_dump(by_alias=True)


@router.post("/entries", status_code=status.HTTP_201_CREATED)
async def create_entry(
    payload: CashflowEntryCreate,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    entry = CashflowEntry(
        user_id=user.id,
        source="manual",
        type=_validate_type(payload.type),
        name=payload.name.strip(),
        category=payload.category.strip(),
        amount=payload.amount,
        date=payload.date,
        pending=False,
    )
    if not entry.name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name is required")
    if not entry.category:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="category is required")
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return ApiResponse(success=True, data=_entry_row(entry)).model_dump(by_alias=True)


@router.patch("/entries/{entry_id}")
async def update_entry(
    entry_id: str,
    payload: CashflowEntryUpdate,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    entry = db.scalar(
        select(CashflowEntry).where(
            CashflowEntry.id == entry_id,
            CashflowEntry.user_id == user.id,
            CashflowEntry.removed_at.is_(None),
        )
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    if entry.source != "manual":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only manual entries can be edited")
    updates = payload.model_dump(exclude_unset=True)
    if "type" in updates and updates["type"] is not None:
        entry.type = _validate_type(updates["type"])
    if "name" in updates and updates["name"] is not None:
        entry.name = updates["name"].strip()
    if "category" in updates and updates["category"] is not None:
        entry.category = updates["category"].strip()
    if "amount" in updates and updates["amount"] is not None:
        entry.amount = updates["amount"]
    if "date" in updates and updates["date"] is not None:
        entry.date = updates["date"]
    if not entry.name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name is required")
    if not entry.category:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="category is required")
    db.commit()
    db.refresh(entry)
    return ApiResponse(success=True, data=_entry_row(entry)).model_dump(by_alias=True)


@router.delete("/entries/{entry_id}")
async def delete_entry(
    entry_id: str,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    entry = db.scalar(
        select(CashflowEntry).where(
            CashflowEntry.id == entry_id,
            CashflowEntry.user_id == user.id,
            CashflowEntry.removed_at.is_(None),
        )
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    entry.removed_at = _now()
    db.commit()
    return ApiResponse(success=True).model_dump(by_alias=True)
