from pydantic import BaseModel, ConfigDict

from models.common import _to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)


class AuthCredentials(CamelModel):
    email: str
    password: str


class PasswordResetRequest(CamelModel):
    email: str


class PasswordResetConfirm(CamelModel):
    token: str
    password: str


class LoanCreate(CamelModel):
    name: str
    principal: float
    interest_rate: float
    loan_term: int
    monthly_payment: float
    total_amount_paid: float
    total_interest: float
    notes: str | None = None


class LoanUpdate(CamelModel):
    name: str | None = None
    principal: float | None = None
    interest_rate: float | None = None
    loan_term: int | None = None
    monthly_payment: float | None = None
    total_amount_paid: float | None = None
    total_interest: float | None = None
    notes: str | None = None


class AssetCreate(CamelModel):
    name: str
    asset_type: str
    value: float
    institution: str | None = None
    notes: str | None = None


class AssetUpdate(CamelModel):
    name: str | None = None
    asset_type: str | None = None
    value: float | None = None
    institution: str | None = None
    notes: str | None = None


class WatchlistCreate(CamelModel):
    name: str
    description: str | None = None
    is_default: bool = False


class WatchlistUpdate(CamelModel):
    name: str | None = None
    description: str | None = None
    is_default: bool | None = None


class WatchlistItemCreate(CamelModel):
    symbol: str
    notes: str | None = None
