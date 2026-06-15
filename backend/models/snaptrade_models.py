from datetime import date, datetime
from typing import List, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    supports_trading: bool = False


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
    supports_trading: bool = False
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


class AccountBalanceSnapshot(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    snapshot_date: date
    account_id: str = ""
    account_name: str | None = None
    total_balance: float = 0.0
    total_gain_loss: float = 0.0
    total_gain_loss_percent: float = 0.0
    holding_count: int = 0
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


OrderAction = Literal["BUY", "SELL"]
OrderType = Literal["MARKET", "LIMIT", "STOP", "STOPLIMIT"]
TimeInForce = Literal["DAY", "GTC", "FOK", "IOC"]


class TradeOrderRequest(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    action: OrderAction | None = None
    symbol: str | None = None
    units: float | None = None
    order_type: OrderType = "MARKET"
    time_in_force: TimeInForce = "DAY"
    limit_price: float | None = None
    stop_price: float | None = None
    notional_value: float | None = None
    # When provided, a previously checked order (from the impact endpoint) is placed directly.
    trade_id: str | None = None

    @model_validator(mode="after")
    def require_order_details_or_trade_id(self):
        if self.trade_id:
            return self
        if not self.action or not self.symbol:
            raise ValueError("action and symbol are required unless tradeId is provided")
        return self


class TradeImpact(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    trade_id: str = ""
    symbol: str = ""
    action: str = ""
    units: float | None = None
    price: float | None = None
    order_type: str = ""
    time_in_force: str = ""
    estimated_commission: float | None = None
    estimated_value: float | None = None
    remaining_cash: float | None = None
    currency: str = "USD"


class TradeExecution(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    brokerage_order_id: str = ""
    account_id: str = ""
    symbol: str = ""
    action: str = ""
    units: float | None = None
    price: float | None = None
    order_type: str = ""
    time_in_force: str = ""
    status: str = ""
    placed_at: str | None = None


RecurringBuyFrequency = Literal["daily", "weekly", "biweekly", "monthly"]


class RecurringBuyScheduleCreate(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    account_id: str
    symbol: str
    # Provide exactly one of: units (fixed-share mode) or target_amount (dollar-cost mode).
    units: float | None = None
    target_amount: float | None = None
    frequency: RecurringBuyFrequency
    start_date: date | None = None


class RecurringBuyScheduleUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    units: float | None = None
    target_amount: float | None = None
    frequency: RecurringBuyFrequency | None = None
    next_run_date: date | None = None
    active: bool | None = None


class RecurringBuySchedule(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    id: str = ""
    account_id: str = ""
    symbol: str = ""
    units: float | None = None
    target_amount: float | None = None
    accumulated_budget: float = 0.0
    frequency: str = ""
    next_run_date: str | None = None
    last_run_date: str | None = None
    last_status: str | None = None
    last_order_id: str | None = None
    active: bool = True


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
