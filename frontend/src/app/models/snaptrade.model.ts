/**
 * SnapTrade API Models
 * Interfaces for SnapTrade brokerage integration
 */

export interface SnapTradeUser {
  id: string;
  userId: string;
  email?: string;
  name?: string;
  createdAt?: Date;
}

export interface Brokerage {
  id: string;
  name: string;
  displayName: string;
  logo?: string;
  slug?: string;
}

export interface BrokerageConnection {
  id: string;
  brokerageId: string;
  brokerageName: string;
  userId: string;
  accounts: Account[];
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'PENDING';
  createdAt?: Date;
  lastSync?: Date;
}

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

export interface TradeOrder {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  timeInForce: 'DAY' | 'GTC' | 'FOK' | 'IOC';
  limitPrice?: number;
  stopPrice?: number;
  accountId: string;
}

export interface TradeExecution {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalAmount: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
  executedAt?: Date;
  accountId: string;
}

export interface AccountBalance {
  accountId: string;
  totalCash: number;
  buyingPower: number;
  currency: string;
  positions: number;
}

export interface SnapTradeError {
  code: string;
  message: string;
  details?: any;
}

