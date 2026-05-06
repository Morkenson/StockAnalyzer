"""SQLAlchemy ORM models for app-owned data."""
from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AppUser(Base):
    __tablename__ = "app_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("app_users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(255))
    principal: Mapped[float] = mapped_column(Numeric(12, 2))
    interest_rate: Mapped[float] = mapped_column(Numeric(5, 2))
    loan_term: Mapped[int]
    monthly_payment: Mapped[float] = mapped_column(Numeric(12, 2))
    total_amount_paid: Mapped[float] = mapped_column(Numeric(12, 2))
    total_interest: Mapped[float] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(255))
    asset_type: Mapped[str] = mapped_column(String(80))
    value: Mapped[float] = mapped_column(Numeric(14, 2))
    institution: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    items: Mapped[list["WatchlistItem"]] = relationship(back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    __table_args__ = (UniqueConstraint("watchlist_id", "symbol", name="uq_watchlist_symbol"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    watchlist_id: Mapped[str] = mapped_column(String(36), ForeignKey("watchlists.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(16))
    notes: Mapped[str | None] = mapped_column(Text)
    added_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    watchlist: Mapped[Watchlist] = relationship(back_populates="items")


class SigninOtp(Base):
    __tablename__ = "signin_otps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("app_users.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class SnapTradeUserSecret(Base):
    __tablename__ = "snaptrade_user_secrets"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_secret: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class SnapTradeAccountPreference(Base):
    __tablename__ = "snaptrade_account_preferences"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    account_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    nickname: Mapped[str | None] = mapped_column(String(255))
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class SnapTradeDividendPreference(Base):
    __tablename__ = "snaptrade_dividend_preferences"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32), primary_key=True)
    currency: Mapped[str] = mapped_column(String(8), primary_key=True, default="USD")
    payment_frequency: Mapped[str] = mapped_column(String(32))
    payments_per_year: Mapped[float] = mapped_column(Numeric(8, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class PlaidItem(Base):
    __tablename__ = "plaid_items"
    __table_args__ = (UniqueConstraint("user_id", "plaid_item_id", name="uq_plaid_item_user_item"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("app_users.id", ondelete="CASCADE"), index=True)
    plaid_item_id: Mapped[str] = mapped_column(String(128), index=True)
    access_token_encrypted: Mapped[str] = mapped_column(Text)
    transaction_cursor: Mapped[str | None] = mapped_column(Text)
    institution_id: Mapped[str | None] = mapped_column(String(128))
    institution_name: Mapped[str | None] = mapped_column(String(255))
    last_sync_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_sync_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    accounts: Mapped[list["PlaidAccount"]] = relationship(back_populates="item", cascade="all, delete-orphan")


class PlaidAccount(Base):
    __tablename__ = "plaid_accounts"
    __table_args__ = (UniqueConstraint("user_id", "plaid_account_id", name="uq_plaid_account_user_account"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("app_users.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[str] = mapped_column(String(36), ForeignKey("plaid_items.id", ondelete="CASCADE"), index=True)
    plaid_account_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(255))
    official_name: Mapped[str | None] = mapped_column(String(255))
    mask: Mapped[str | None] = mapped_column(String(16))
    type: Mapped[str] = mapped_column(String(80))
    subtype: Mapped[str | None] = mapped_column(String(80))
    current_balance: Mapped[float | None] = mapped_column(Numeric(14, 2))
    available_balance: Mapped[float | None] = mapped_column(Numeric(14, 2))
    iso_currency_code: Mapped[str | None] = mapped_column(String(8))
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    balance_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    item: Mapped[PlaidItem] = relationship(back_populates="accounts")


class CashflowEntry(Base):
    __tablename__ = "cashflow_entries"
    __table_args__ = (UniqueConstraint("user_id", "plaid_transaction_id", name="uq_cashflow_user_plaid_transaction"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("app_users.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(24), default="manual", index=True)
    type: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(255))
    merchant_name: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(120))
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    date: Mapped[date] = mapped_column(Date, index=True)
    plaid_item_id: Mapped[str | None] = mapped_column(String(128), index=True)
    plaid_account_id: Mapped[str | None] = mapped_column(String(128), index=True)
    plaid_transaction_id: Mapped[str | None] = mapped_column(String(128), index=True)
    pending: Mapped[bool] = mapped_column(Boolean, default=False)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
