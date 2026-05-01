from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0].lower() + "".join(p.capitalize() for p in parts[1:])


class SnapTradeUser(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    id: str = ""
    user_id: str = ""
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
    account_number: str = ""
    type: str = ""
    brokerage_id: str = ""
    balance: float | None = None
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
