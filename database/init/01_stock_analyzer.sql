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

CREATE TABLE IF NOT EXISTS snaptrade_user_secrets (
  user_id VARCHAR(128) PRIMARY KEY,
  user_secret TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
