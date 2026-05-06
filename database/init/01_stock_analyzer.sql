CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS app_users (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id VARCHAR(36) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS loans (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id VARCHAR(128) NOT NULL,
  name TEXT NOT NULL,
  principal DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  loan_term INTEGER NOT NULL,
  monthly_payment DECIMAL(12,2) NOT NULL,
  total_amount_paid DECIMAL(12,2) NOT NULL,
  total_interest DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);

CREATE TABLE IF NOT EXISTS assets (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id VARCHAR(128) NOT NULL,
  name TEXT NOT NULL,
  asset_type VARCHAR(80) NOT NULL,
  value DECIMAL(14,2) NOT NULL,
  institution TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);

CREATE TABLE IF NOT EXISTS watchlists (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id VARCHAR(128) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  watchlist_id VARCHAR(36) NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol VARCHAR(16) NOT NULL,
  notes TEXT,
  added_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_watchlist_symbol UNIQUE (watchlist_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);

CREATE TABLE IF NOT EXISTS signin_otps (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id VARCHAR(36) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signin_otps_user_id ON signin_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_signin_otps_expires_at ON signin_otps(expires_at);

CREATE TABLE IF NOT EXISTS snaptrade_user_secrets (
  user_id VARCHAR(128) PRIMARY KEY,
  user_secret TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS snaptrade_account_preferences (
  user_id VARCHAR(128) NOT NULL,
  account_id VARCHAR(128) NOT NULL,
  nickname VARCHAR(255),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_snaptrade_account_preferences_user_id ON snaptrade_account_preferences(user_id);

CREATE TABLE IF NOT EXISTS snaptrade_dividend_preferences (
  user_id VARCHAR(128) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  payment_frequency VARCHAR(32) NOT NULL,
  payments_per_year DECIMAL(8,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, symbol, currency)
);

CREATE INDEX IF NOT EXISTS idx_snaptrade_dividend_preferences_user_id ON snaptrade_dividend_preferences(user_id);

CREATE TABLE IF NOT EXISTS plaid_items (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id VARCHAR(36) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  plaid_item_id VARCHAR(128) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  transaction_cursor TEXT,
  institution_id VARCHAR(128),
  institution_name VARCHAR(255),
  last_sync_started_at TIMESTAMP WITH TIME ZONE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_plaid_item_user_item UNIQUE (user_id, plaid_item_id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_plaid_item_id ON plaid_items(plaid_item_id);

CREATE TABLE IF NOT EXISTS plaid_accounts (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id VARCHAR(36) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  item_id VARCHAR(36) NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  plaid_account_id VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  official_name VARCHAR(255),
  mask VARCHAR(16),
  type VARCHAR(80) NOT NULL,
  subtype VARCHAR(80),
  current_balance DECIMAL(14,2),
  available_balance DECIMAL(14,2),
  iso_currency_code VARCHAR(8),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  balance_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_plaid_account_user_account UNIQUE (user_id, plaid_account_id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user_id ON plaid_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item_id ON plaid_accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_plaid_account_id ON plaid_accounts(plaid_account_id);

CREATE TABLE IF NOT EXISTS cashflow_entries (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id VARCHAR(36) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  source VARCHAR(24) NOT NULL DEFAULT 'manual',
  type VARCHAR(16) NOT NULL,
  name VARCHAR(255) NOT NULL,
  merchant_name VARCHAR(255),
  category VARCHAR(120) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  date DATE NOT NULL,
  plaid_item_id VARCHAR(128),
  plaid_account_id VARCHAR(128),
  plaid_transaction_id VARCHAR(128),
  pending BOOLEAN NOT NULL DEFAULT FALSE,
  removed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_cashflow_user_plaid_transaction UNIQUE (user_id, plaid_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_cashflow_entries_user_id ON cashflow_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_source ON cashflow_entries(source);
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_date ON cashflow_entries(date);
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_plaid_transaction_id ON cashflow_entries(plaid_transaction_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_removed_at ON cashflow_entries(removed_at);
