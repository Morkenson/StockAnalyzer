from typing import Literal

from pydantic import Field

from models.real_estate_models import CamelModel

FilingStatus = Literal["single", "married_joint", "head_of_household"]


class TaxProfileUpsert(CamelModel):
    tax_year: int = Field(default=2025, ge=2025)
    filing_status: FilingStatus = "single"
    gross_income: float = Field(default=0, ge=0)
    pre_tax_contributions: float = Field(default=0, ge=0)
    use_itemized: bool = False
    itemized_deduction: float = Field(default=0, ge=0)
    withholdings_paid: float = Field(default=0, ge=0)


class TaxCalculationResult(CamelModel):
    tax_year: int
    filing_status: FilingStatus
    gross_income: float
    pre_tax_contributions: float
    agi: float
    deduction: float
    taxable_income: float
    federal_tax: float
    fica_tax: float
    social_security_tax: float
    medicare_tax: float
    additional_medicare_tax: float
    state_tax: float
    total_tax: float
    withholdings_paid: float
    balance_due: float
    effective_rate: float
