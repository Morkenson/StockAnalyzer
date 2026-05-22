export interface Account {
  id: string;
  accountNumber: string;
  name: string;
  nickname?: string | null;
  type: 'RRSP' | 'LIRA' | 'RESP' | 'TFSA' | 'MARGIN' | 'CASH' | 'OTHER';
  brokerageId: string;
  balance?: number;
  marginBalance?: number | null;
  marginInterestRate?: number | null;
  currency: string;
  holdings?: Holding[];
}

export interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  averagePurchasePrice: number;
  currentPrice: number;
  totalValue: number;
  bookValue: number;
  gainLoss: number;
  gainLossPercent: number;
  currency: string;
}

export interface Portfolio {
  userId: string;
  accounts: Account[];
  totalBalance: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  currency: string;
}

export interface PortfolioBalanceSnapshot {
  snapshotDate: string;
  totalBalance: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  accountCount: number;
  currency: string;
}

export interface RecurringInvestment {
  symbol: string;
  accountId: string;
  accountName: string;
  amount: number;
  currency: string;
  frequency: string;
  confidence: number;
  occurrences: number;
  lastDate: string;
  nextEstimatedDate?: string | null;
  source: string;
}

export interface RecurringInvestmentPreference {
  accountId: string;
  symbol: string;
  currency: string;
  amount?: number | null;
  frequency?: string | null;
  hidden: boolean;
}

export interface DividendIncomeTotal {
  currency: string;
  annualIncome: number;
  monthlyIncome: number;
}

export interface DividendIncomeAccount {
  accountId: string;
  accountName: string;
  currency: string;
  annualIncome: number;
  monthlyIncome: number;
  paymentCount: number;
  lastPaymentDate?: string | null;
}

export interface DividendIncomeSymbol {
  symbol: string;
  accountId: string;
  accountName: string;
  currency: string;
  currentQuantity: number;
  annualIncome: number;
  monthlyIncome: number;
  averagePaymentPerShare: number;
  paymentFrequency: string;
  paymentsPerYear: number;
  paymentCount: number;
  lastPaymentDate?: string | null;
}

export interface DividendIncomeSummary {
  userId: string;
  lookbackDays: number;
  totals: DividendIncomeTotal[];
  accounts: DividendIncomeAccount[];
  symbols: DividendIncomeSymbol[];
  paymentCount: number;
  lastPaymentDate?: string | null;
  source: string;
}
