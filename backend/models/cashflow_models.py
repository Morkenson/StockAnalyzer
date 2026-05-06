from datetime import date as dt_date, datetime

from pydantic import Field

from models.persistence_models import CamelModel


class CashflowEntryCreate(CamelModel):
    type: str
    name: str
    category: str
    amount: float = Field(gt=0)
    date: dt_date


class CashflowEntryUpdate(CamelModel):
    type: str | None = None
    name: str | None = None
    category: str | None = None
    amount: float | None = Field(default=None, gt=0)
    date: dt_date | None = None


class PlaidPublicTokenExchange(CamelModel):
    public_token: str
    institution_id: str | None = None
    institution_name: str | None = None


class PlaidSyncRequest(CamelModel):
    auto: bool = False


class CashflowEntryRow(CamelModel):
    id: str
    source: str
    type: str
    name: str
    merchant_name: str | None = None
    category: str
    amount: float
    date: dt_date
    plaid_account_id: str | None = None
    plaid_transaction_id: str | None = None
    pending: bool = False
    created_at: datetime
    updated_at: datetime
