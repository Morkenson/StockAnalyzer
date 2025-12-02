export interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  currentPrice: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  averageVolume?: number;
  high52Week?: number;
  low52Week?: number;
  peRatio?: number;
  dividendYield?: number;
  description?: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

export interface StockHistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface StockMetrics {
  symbol: string;
  marketCap: number;
  peRatio: number;
  dividendYield: number;
  // Removed: eps, beta, revenue, profitMargin, roe, debtToEquity (not available in Twelve Data free plan)
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  addedDate: Date;
  notes?: string;
}

