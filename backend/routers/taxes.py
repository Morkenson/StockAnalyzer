"""Saved tax profile and estimated tax calculations."""
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from db_models import AppUser, TaxProfile
from models.common import ApiResponse
from models.taxes_models import TaxProfileUpsert
from routers.persistence import _current_user, _text_eq
from services import tax_service

router = APIRouter(prefix="/taxes", tags=["taxes"])


def _number(value) -> float:
    return float(value) if isinstance(value, Decimal) else value


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _profile_row(profile: TaxProfile) -> dict:
    return {
        "id": profile.id,
        "taxYear": profile.tax_year,
        "filingStatus": profile.filing_status,
        "grossIncome": _number(profile.gross_income),
        "preTaxContributions": _number(profile.pre_tax_contributions),
        "useItemized": profile.use_itemized,
        "itemizedDeduction": _number(profile.itemized_deduction),
        "withholdingsPaid": _number(profile.withholdings_paid),
        "createdAt": _iso(profile.created_at),
        "updatedAt": _iso(profile.updated_at),
    }


@router.get("/profile")
async def get_profile(user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    profile = db.scalar(select(TaxProfile).where(_text_eq(TaxProfile.user_id, user.id)))
    return ApiResponse(success=True, data=_profile_row(profile) if profile else None).model_dump(by_alias=True)


@router.put("/profile")
async def save_profile(
    payload: TaxProfileUpsert,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    profile = db.scalar(select(TaxProfile).where(_text_eq(TaxProfile.user_id, user.id)))
    if not profile:
        profile = TaxProfile(user_id=user.id)
        db.add(profile)
    profile.tax_year = payload.tax_year
    profile.filing_status = payload.filing_status
    profile.gross_income = payload.gross_income
    profile.pre_tax_contributions = payload.pre_tax_contributions
    profile.use_itemized = payload.use_itemized
    profile.itemized_deduction = payload.itemized_deduction
    profile.withholdings_paid = payload.withholdings_paid
    db.commit()
    db.refresh(profile)
    return ApiResponse(success=True, data=_profile_row(profile)).model_dump(by_alias=True)


@router.post("/calculate")
async def calculate(payload: TaxProfileUpsert, user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    return ApiResponse(success=True, data=tax_service.calculate_taxes(payload)).model_dump(by_alias=True)
