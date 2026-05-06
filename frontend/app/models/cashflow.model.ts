export type CashflowType = 'income' | 'expense';
export type CashflowSource = 'manual' | 'plaid';

export interface CashflowEntry {
  id: string;
  source: CashflowSource;
  type: CashflowType;
  name: string;
  merchantName?: string | null;
  category: string;
  amount: number;
  date: string;
  plaidAccountId?: string | null;
  plaidTransactionId?: string | null;
  pending: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CashflowEntryCreate {
  type: CashflowType;
  name: string;
  category: string;
  amount: number;
  date: string;
}

export interface PlaidAccount {
  id: string;
  itemId: string;
  plaidAccountId: string;
  name: string;
  officialName?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  currentBalance?: number | null;
  availableBalance?: number | null;
  isoCurrencyCode?: string | null;
  institutionName?: string | null;
  balanceUpdatedAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
}

export interface PlaidSyncSummary {
  added: number;
  modified: number;
  removed: number;
  itemsSynced: number;
  skipped: boolean;
}
