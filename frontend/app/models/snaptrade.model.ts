export interface Account {
  id: string;
  accountNumber: string;
  name: string;
  type: 'RRSP' | 'LIRA' | 'RESP' | 'TFSA' | 'MARGIN' | 'CASH' | 'OTHER';
  brokerageId: string;
  balance?: number;
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
