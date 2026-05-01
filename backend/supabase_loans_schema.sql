-- Loans table schema for Supabase
-- Run this SQL in your Supabase SQL Editor to create the loans table

CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);

-- Enable Row Level Security
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own loans
CREATE POLICY "Users can view own loans" ON loans
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own loans
CREATE POLICY "Users can insert own loans" ON loans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own loans
CREATE POLICY "Users can update own loans" ON loans
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own loans
CREATE POLICY "Users can delete own loans" ON loans
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
