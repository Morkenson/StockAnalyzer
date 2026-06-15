from pydantic import BaseModel, ConfigDict

from models.common import _to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)


class RealEstatePropertyCreate(CamelModel):
    name: str
    address: str | None = None
    city: str | None = None
    country: str | None = None
    property_type: str | None = None
    currency: str = "USD"
    purchase_price: float
    down_payment_pct: float
    closing_costs: float = 0
    interest_rate: float
    loan_term_years: int
    monthly_rent: float
    vacancy_rate_pct: float = 0
    property_tax_annual: float = 0
    insurance_annual: float = 0
    hoa_monthly: float = 0
    maintenance_pct: float = 0
    management_pct: float = 0
    other_monthly_costs: float = 0
    appreciation_pct: float = 0
    hold_years: int = 10
    monthly_cash_flow: float
    cap_rate: float
    cash_on_cash_return: float
    notes: str | None = None


class RealEstatePropertyUpdate(CamelModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    property_type: str | None = None
    currency: str | None = None
    purchase_price: float | None = None
    down_payment_pct: float | None = None
    closing_costs: float | None = None
    interest_rate: float | None = None
    loan_term_years: int | None = None
    monthly_rent: float | None = None
    vacancy_rate_pct: float | None = None
    property_tax_annual: float | None = None
    insurance_annual: float | None = None
    hoa_monthly: float | None = None
    maintenance_pct: float | None = None
    management_pct: float | None = None
    other_monthly_costs: float | None = None
    appreciation_pct: float | None = None
    hold_years: int | None = None
    monthly_cash_flow: float | None = None
    cap_rate: float | None = None
    cash_on_cash_return: float | None = None
    notes: str | None = None
