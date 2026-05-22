from datetime import date, datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0].lower() + "".join(p.capitalize() for p in parts[1:])


class SnapTradeUser(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    id: str = ""
    user_id: str = ""
    user_secret: str | None = None
    email: str | None = None
    created_at: datetime | None = None


class Brokerage(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    id: str = ""
    name: str = ""
    display_name: str | None = None
    description: str | None = None
    supports_oauth: bool = False


class Holding(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    symbol: str = ""
    quantity: float = 0.0
    average_purchase_price: float = 0.0
    current_price: float = 0.0
    total_value: float = 0.0
    gain_loss: float = 0.0
    gain_loss_percent: float = 0.0
    currency: str = "USD"


class Account(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    id: str = ""
    name: str = ""
    nickname: str | None = None
    account_number: str = ""
    type: str = ""
    brokerage_id: str = ""
    balance: float | None = None
    margin_balance: float | None = None
    margin_interest_rate: float | None = None
    currency: str = "USD"
    holdings: List[Holding] = Field(default_factory=list)


class Portfolio(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    user_id: str = ""
    accounts: List[Account] = Field(default_factory=list)
    total_balance: float = 0.0
    total_gain_loss: float = 0.0
    total_gain_loss_percent: float = 0.0
    currency: str = "USD"


class PortfolioBalanceSnapshot(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    snapshot_date: date
    total_balance: float = 0.0
    total_gain_loss: float = 0.0
    total_gain_loss_percent: float = 0.0
    account_count: int = 0
    currency: str = "USD"


class RecurringInvestment(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    symbol: str = ""
    account_id: str = ""
    account_name: str = ""
    amount: float = 0.0
    currency: str = "USD"
    frequency: str = ""
    confidence: float = 0.0
    occurrences: int = 0
    last_date: str = ""
    next_estimated_date: str | None = None
    source: str = "inferred"


class DividendIncomeTotal(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    currency: str = "USD"
    annual_income: float = 0.0
    monthly_income: float = 0.0


class DividendIncomeAccount(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    account_id: str = ""
    account_name: str = ""
    currency: str = "USD"
    annual_income: float = 0.0
    monthly_income: float = 0.0
    payment_count: int = 0
    last_payment_date: str | None = None


class DividendIncomeSymbol(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    symbol: str = ""
    account_id: str = ""
    account_name: str = ""
    currency: str = "USD"
    current_quantity: float = 0.0
    annual_income: float = 0.0
    monthly_income: float = 0.0
    average_payment_per_share: float = 0.0
    payment_frequency: str = "unknown"
    payments_per_year: float = 0.0
    payment_count: int = 0
    last_payment_date: str | None = None


class DividendIncomeSummary(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    user_id: str = ""
    lookback_days: int = 365
    totals: List[DividendIncomeTotal] = Field(default_factory=list)
    accounts: List[DividendIncomeAccount] = Field(default_factory=list)
    symbols: List[DividendIncomeSymbol] = Field(default_factory=list)
    payment_count: int = 0
    last_payment_date: str | None = None
    source: str = "average_historical_payout_current_holdings"


class AccountPreferenceUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    nickname: str | None = None
    margin_balance: float | None = None
    margin_interest_rate: float | None = None
    hidden: bool | None = None


class DividendFrequencyPreferenceUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    symbol: str = ""
    currency: str = "USD"
    payment_frequency: str = ""
    hidden: bool | None = None


class DividendPreferenceClearItem(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    symbol: str = ""
    currency: str = "USD"


class DividendPreferenceClearRequest(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    symbols: List[DividendPreferenceClearItem] = Field(default_factory=list)


class RecurringInvestmentPreferenceUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    account_id: str = ""
    symbol: str = ""
    currency: str = "USD"
    amount: float | None = None
    frequency: str | None = None
    hidden: bool | None = None
