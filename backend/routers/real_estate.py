"""Real estate listing search and saved property analyses."""
import logging
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from db_models import AppUser, RealEstateProperty
from models.common import ApiResponse
from models.real_estate_models import RealEstatePropertyCreate, RealEstatePropertyUpdate
from routers.persistence import _current_user, _text_eq
from services import real_estate_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/real-estate", tags=["real-estate"])


def _number(value) -> float:
    return float(value) if isinstance(value, Decimal) else value


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _property_row(prop: RealEstateProperty) -> dict:
    return {
        "id": prop.id,
        "name": prop.name,
        "address": prop.address,
        "city": prop.city,
        "country": prop.country,
        "propertyType": prop.property_type,
        "currency": prop.currency,
        "purchasePrice": _number(prop.purchase_price),
        "downPaymentPct": _number(prop.down_payment_pct),
        "closingCosts": _number(prop.closing_costs),
        "interestRate": _number(prop.interest_rate),
        "loanTermYears": prop.loan_term_years,
        "monthlyRent": _number(prop.monthly_rent),
        "vacancyRatePct": _number(prop.vacancy_rate_pct),
        "propertyTaxAnnual": _number(prop.property_tax_annual),
        "insuranceAnnual": _number(prop.insurance_annual),
        "hoaMonthly": _number(prop.hoa_monthly),
        "maintenancePct": _number(prop.maintenance_pct),
        "managementPct": _number(prop.management_pct),
        "otherMonthlyCosts": _number(prop.other_monthly_costs),
        "appreciationPct": _number(prop.appreciation_pct),
        "holdYears": prop.hold_years,
        "monthlyCashFlow": _number(prop.monthly_cash_flow),
        "capRate": _number(prop.cap_rate),
        "cashOnCashReturn": _number(prop.cash_on_cash_return),
        "notes": prop.notes,
        "createdAt": _iso(prop.created_at),
        "updatedAt": _iso(prop.updated_at),
    }


@router.get("/search")
async def search_listings(
    location: str = Query("", max_length=160),
    min_price: float | None = Query(None, alias="minPrice", ge=0),
    max_price: float | None = Query(None, alias="maxPrice", ge=0),
    property_type: str | None = Query(None, alias="propertyType", max_length=80),
    min_bedrooms: int | None = Query(None, alias="minBedrooms", ge=0),
    refresh: bool = Query(False),
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    result = await real_estate_service.search_listings(
        location=location.strip(),
        min_price=min_price,
        max_price=max_price,
        property_type=property_type.strip() if property_type else None,
        min_bedrooms=min_bedrooms,
        db=db,
        refresh=refresh,
    )
    return ApiResponse(success=True, data=result).model_dump(by_alias=True)


@router.get("/usage")
async def get_usage(user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    return ApiResponse(success=True, data=real_estate_service.usage_summary(db)).model_dump(by_alias=True)


@router.get("/properties")
async def get_properties(user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    properties = db.scalars(
        select(RealEstateProperty)
        .where(_text_eq(RealEstateProperty.user_id, user.id))
        .order_by(RealEstateProperty.created_at.desc())
    ).all()
    return ApiResponse(success=True, data=[_property_row(prop) for prop in properties]).model_dump(by_alias=True)


@router.post("/properties", status_code=status.HTTP_201_CREATED)
async def create_property(
    payload: RealEstatePropertyCreate,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    if payload.purchase_price <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase price must be greater than 0")
    try:
        prop = RealEstateProperty(
            user_id=user.id,
            name=payload.name.strip(),
            address=payload.address.strip() if payload.address else None,
            city=payload.city.strip() if payload.city else None,
            country=payload.country.strip() if payload.country else None,
            property_type=payload.property_type.strip() if payload.property_type else None,
            currency=payload.currency.strip().upper() or "USD",
            purchase_price=payload.purchase_price,
            down_payment_pct=payload.down_payment_pct,
            closing_costs=payload.closing_costs,
            interest_rate=payload.interest_rate,
            loan_term_years=payload.loan_term_years,
            monthly_rent=payload.monthly_rent,
            vacancy_rate_pct=payload.vacancy_rate_pct,
            property_tax_annual=payload.property_tax_annual,
            insurance_annual=payload.insurance_annual,
            hoa_monthly=payload.hoa_monthly,
            maintenance_pct=payload.maintenance_pct,
            management_pct=payload.management_pct,
            other_monthly_costs=payload.other_monthly_costs,
            appreciation_pct=payload.appreciation_pct,
            hold_years=payload.hold_years,
            monthly_cash_flow=payload.monthly_cash_flow,
            cap_rate=payload.cap_rate,
            cash_on_cash_return=payload.cash_on_cash_return,
            notes=payload.notes.strip() if payload.notes else None,
        )
        db.add(prop)
        db.commit()
        db.refresh(prop)
        return ApiResponse(success=True, data=_property_row(prop)).model_dump(by_alias=True)
    except Exception:
        db.rollback()
        logger.exception("create_property failed for user_id=%s", user.id)
        raise


@router.patch("/properties/{property_id}")
async def update_property(
    property_id: str,
    payload: RealEstatePropertyUpdate,
    user: AppUser = Depends(_current_user),
    db: Session = Depends(get_db),
):
    prop = db.scalar(
        select(RealEstateProperty).where(
            _text_eq(RealEstateProperty.id, property_id),
            _text_eq(RealEstateProperty.user_id, user.id),
        )
    )
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(prop, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(prop)
    return ApiResponse(success=True, data=_property_row(prop)).model_dump(by_alias=True)


@router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user: AppUser = Depends(_current_user), db: Session = Depends(get_db)):
    prop = db.scalar(
        select(RealEstateProperty).where(
            _text_eq(RealEstateProperty.id, property_id),
            _text_eq(RealEstateProperty.user_id, user.id),
        )
    )
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    db.delete(prop)
    db.commit()
    return ApiResponse(success=True).model_dump(by_alias=True)
