"""Plaid routes for account linking, balances, and transaction sync."""
import logging

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from db_models import AppUser, CashflowEntry, PlaidAccount, PlaidItem
from models.cashflow_models import PlaidPublicTokenExchange, PlaidSyncRequest
from models.common import ApiResponse
from routers.persistence import _current_user
from services import plaid_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/plaid", tags=["plaid"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _error_response(exc: Exception) -> JSONResponse:
    status_code = getattr(exc, "status_code", 400)
    if isinstance(exc, plaid_service.PlaidConfigurationError):
        status_code = 503
    return JSONResponse(
        status_code=status_code,
        content=ApiResponse(success=False, message=str(exc)).model_dump(by_alias=True),
    )


@router.post("/link-token")
async def create_link_token(user: AppUser = Depends(_current_user)):
    try:
        link_token = await plaid_service.create_link_token(user.id)
        return ApiResponse(success=True, data={"linkToken": link_token}).model_dump(by_alias=True)
    except Exception as exc:
        logger.warning("Plaid link token failed: %s", exc)
        return _error_response(exc)


@router.post("/exchange-public-token")
async def exchange_public_token(
    payload: PlaidPublicTokenExchange,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    try:
        data = await plaid_service.exchange_public_token(
            db,
            user.id,
            payload.public_token,
            institution_id=payload.institution_id,
            institution_name=payload.institution_name,
        )
        return ApiResponse(success=True, data=data).model_dump(by_alias=True)
    except Exception as exc:
        logger.warning("Plaid public token exchange failed: %s", exc)
        return _error_response(exc)


@router.post("/sync")
async def sync_plaid(
    payload: PlaidSyncRequest | None = None,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    try:
        data = await plaid_service.sync_user_items(db, user.id, auto=bool(payload and payload.auto))
        return ApiResponse(success=True, data=data).model_dump(by_alias=True)
    except Exception as exc:
        logger.warning("Plaid sync failed: %s", exc)
        return _error_response(exc)


@router.get("/accounts")
async def get_accounts(user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    accounts = db.scalars(
        select(PlaidAccount)
        .where(PlaidAccount.user_id == user.id, PlaidAccount.hidden.is_(False))
        .order_by(PlaidAccount.type.asc(), PlaidAccount.name.asc())
    ).all()
    return ApiResponse(success=True, data=[plaid_service.account_row(account) for account in accounts]).model_dump(
        by_alias=True
    )


@router.patch("/accounts/{account_id}/hide")
async def hide_account_locally(
    account_id: str,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    account = db.scalar(
        select(PlaidAccount).where(
            PlaidAccount.user_id == user.id,
            PlaidAccount.id == account_id,
            PlaidAccount.hidden.is_(False),
        )
    )
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plaid account not found")

    removed_at = _now()
    entries = db.scalars(
        select(CashflowEntry).where(
            CashflowEntry.user_id == user.id,
            CashflowEntry.plaid_account_id == account.plaid_account_id,
            CashflowEntry.removed_at.is_(None),
        )
    ).all()
    account.hidden = True
    for entry in entries:
        entry.removed_at = removed_at
    db.commit()
    return ApiResponse(
        success=True,
        data={"accountId": account.id, "hidden": True, "removedEntries": len(entries)},
    ).model_dump(by_alias=True)


@router.delete("/accounts/{account_id}")
async def disconnect_account_connection(
    account_id: str,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    try:
        account = db.scalar(
            select(PlaidAccount).where(
                PlaidAccount.user_id == user.id,
                PlaidAccount.id == account_id,
                PlaidAccount.hidden.is_(False),
            )
        )
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plaid account not found")

        item = db.scalar(select(PlaidItem).where(PlaidItem.id == account.item_id, PlaidItem.user_id == user.id))
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plaid connection not found")

        await plaid_service.remove_item(plaid_service.decrypt_access_token(item.access_token_encrypted))

        removed_at = _now()
        accounts = db.scalars(
            select(PlaidAccount).where(
                PlaidAccount.user_id == user.id,
                PlaidAccount.item_id == item.id,
                PlaidAccount.hidden.is_(False),
            )
        ).all()
        plaid_account_ids = [row.plaid_account_id for row in accounts]
        for row in accounts:
            row.hidden = True

        entries = db.scalars(
            select(CashflowEntry).where(
                CashflowEntry.user_id == user.id,
                CashflowEntry.plaid_account_id.in_(plaid_account_ids),
                CashflowEntry.removed_at.is_(None),
            )
        ).all()
        for entry in entries:
            entry.removed_at = removed_at
        db.delete(item)
        db.commit()
        return ApiResponse(success=True, data={"accountId": account.id, "removedAccounts": len(accounts), "removedEntries": len(entries)}).model_dump(
            by_alias=True
        )
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.warning("Plaid disconnect failed: %s", exc)
        return _error_response(exc)
