from models.taxes_models import TaxProfileUpsert
from services.tax_data import DEFAULT_TAX_YEAR, FEDERAL_BRACKETS, FICA, STANDARD_DEDUCTIONS, WISCONSIN_BRACKETS


def _supported_year(year: int) -> int:
    return year if year in FEDERAL_BRACKETS else DEFAULT_TAX_YEAR


def _progressive_tax(income: float, brackets: list[tuple[float, float | None, float]]) -> float:
    tax = 0.0
    for lower, upper, rate in brackets:
        if income <= lower:
            break
        taxable_at_rate = min(income, upper if upper is not None else income) - lower
        tax += taxable_at_rate * rate
        if upper is None or income <= upper:
            break
    return tax


def _round_money(value: float) -> float:
    return round(value + 0.0000001, 2)


def calculate_taxes(inputs: TaxProfileUpsert | dict) -> dict:
    payload = inputs if isinstance(inputs, TaxProfileUpsert) else TaxProfileUpsert(**inputs)
    year = _supported_year(payload.tax_year)
    filing_status = payload.filing_status
    gross_income = max(0.0, float(payload.gross_income or 0))
    pre_tax_contributions = max(0.0, float(payload.pre_tax_contributions or 0))
    itemized_deduction = max(0.0, float(payload.itemized_deduction or 0))
    withholdings_paid = max(0.0, float(payload.withholdings_paid or 0))

    agi = max(0.0, gross_income - pre_tax_contributions)
    deduction = itemized_deduction if payload.use_itemized else STANDARD_DEDUCTIONS[year][filing_status]
    taxable_income = max(0.0, agi - deduction)

    federal_tax = _progressive_tax(taxable_income, FEDERAL_BRACKETS[year][filing_status])
    fica = FICA[year]
    social_security_tax = min(gross_income, fica["social_security_wage_base"]) * fica["social_security_rate"]
    medicare_tax = gross_income * fica["medicare_rate"]
    additional_medicare_tax = (
        max(0.0, gross_income - fica["additional_medicare_thresholds"][filing_status])
        * fica["additional_medicare_rate"]
    )
    fica_tax = social_security_tax + medicare_tax + additional_medicare_tax
    state_tax = _progressive_tax(taxable_income, WISCONSIN_BRACKETS[year][filing_status])
    total_tax = federal_tax + fica_tax + state_tax
    balance_due = total_tax - withholdings_paid
    effective_rate = (total_tax / gross_income * 100) if gross_income else 0.0

    return {
        "taxYear": year,
        "filingStatus": filing_status,
        "grossIncome": _round_money(gross_income),
        "preTaxContributions": _round_money(pre_tax_contributions),
        "agi": _round_money(agi),
        "deduction": _round_money(deduction),
        "taxableIncome": _round_money(taxable_income),
        "federalTax": _round_money(federal_tax),
        "ficaTax": _round_money(fica_tax),
        "socialSecurityTax": _round_money(social_security_tax),
        "medicareTax": _round_money(medicare_tax),
        "additionalMedicareTax": _round_money(additional_medicare_tax),
        "stateTax": _round_money(state_tax),
        "totalTax": _round_money(total_tax),
        "withholdingsPaid": _round_money(withholdings_paid),
        "balanceDue": _round_money(balance_due),
        "effectiveRate": round(effective_rate + 0.0000001, 2),
    }
