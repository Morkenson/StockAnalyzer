import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Stock, StockQuote, StockHistoricalData, StockSearchResult, StockMetrics } from '../models/stock.model';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  // TODO: Replace with your actual API endpoint
  private apiUrl = 'https://api.example.com/stocks'; // Replace with your API
  
  // TODO: Add your API key if required
  private apiKey = 'YOUR_API_KEY_HERE';

  constructor(private http: HttpClient) {}

  /**
   * Search for stocks by symbol or name
   * TODO: Implement actual API call
   */
  searchStocks(query: string): Observable<StockSearchResult[]> {
    // Example implementation - replace with actual API call
    const params = new HttpParams()
      .set('q', query)
      .set('apikey', this.apiKey);

    return this.http.get<StockSearchResult[]>(`${this.apiUrl}/search`, { params })
      .pipe(
        catchError(error => {
          console.error('Error searching stocks:', error);
          // Return mock data for development
          return of(this.getMockSearchResults(query));
        })
      );
  }

  /**
   * Get stock details by symbol
   * TODO: Implement actual API call
   */
  getStockDetails(symbol: string): Observable<Stock> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('apikey', this.apiKey);

    return this.http.get<Stock>(`${this.apiUrl}/quote`, { params })
      .pipe(
        catchError(error => {
          console.error('Error fetching stock details:', error);
          return of(this.getMockStock(symbol));
        })
      );
  }

  /**
   * Get real-time stock quote
   * TODO: Implement actual API call
   */
  getStockQuote(symbol: string): Observable<StockQuote> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('apikey', this.apiKey);

    return this.http.get<StockQuote>(`${this.apiUrl}/quote/realtime`, { params })
      .pipe(
        catchError(error => {
          console.error('Error fetching stock quote:', error);
          return of(this.getMockQuote(symbol));
        })
      );
  }

  /**
   * Get historical stock data
   * TODO: Implement actual API call
   */
  getHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval: '1d' | '1w' | '1m' = '1d'
  ): Observable<StockHistoricalData[]> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString())
      .set('interval', interval)
      .set('apikey', this.apiKey);

    return this.http.get<StockHistoricalData[]>(`${this.apiUrl}/historical`, { params })
      .pipe(
        catchError(error => {
          console.error('Error fetching historical data:', error);
          return of(this.getMockHistoricalData(symbol));
        })
      );
  }

  /**
   * Get stock metrics (PE ratio, market cap, etc.)
   * TODO: Implement actual API call
   */
  getStockMetrics(symbol: string): Observable<StockMetrics> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('apikey', this.apiKey);

    return this.http.get<StockMetrics>(`${this.apiUrl}/metrics`, { params })
      .pipe(
        catchError(error => {
          console.error('Error fetching stock metrics:', error);
          return of(this.getMockMetrics(symbol));
        })
      );
  }

  /**
   * Get multiple stock quotes at once
   * TODO: Implement actual API call
   */
  getMultipleQuotes(symbols: string[]): Observable<StockQuote[]> {
    const params = new HttpParams()
      .set('symbols', symbols.join(','))
      .set('apikey', this.apiKey);

    return this.http.get<StockQuote[]>(`${this.apiUrl}/quotes/batch`, { params })
      .pipe(
        catchError(error => {
          console.error('Error fetching multiple quotes:', error);
          return of(symbols.map(s => this.getMockQuote(s)));
        })
      );
  }

  // Mock data methods for development (remove when API is implemented)
  private getMockSearchResults(query: string): StockSearchResult[] {
    return [
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'Equity' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', type: 'Equity' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'Equity' }
    ].filter(s => s.symbol.toLowerCase().includes(query.toLowerCase()) || 
                   s.name.toLowerCase().includes(query.toLowerCase()));
  }

  private getMockStock(symbol: string): Stock {
    return {
      symbol: symbol,
      name: `${symbol} Company`,
      exchange: 'NASDAQ',
      currentPrice: 150.50,
      previousClose: 148.75,
      change: 1.75,
      changePercent: 1.18,
      volume: 50000000,
      averageVolume: 45000000,
      high52Week: 180.00,
      low52Week: 120.00,
      marketCap: 2500000000000,
      peRatio: 28.5,
      dividendYield: 0.5
    };
  }

  private getMockQuote(symbol: string): StockQuote {
    const basePrice = 150 + Math.random() * 50;
    const change = (Math.random() - 0.5) * 10;
    return {
      symbol: symbol,
      price: basePrice,
      change: change,
      changePercent: (change / (basePrice - change)) * 100,
      volume: Math.floor(Math.random() * 100000000),
      timestamp: new Date()
    };
  }

  private getMockHistoricalData(symbol: string): StockHistoricalData[] {
    const data: StockHistoricalData[] = [];
    const basePrice = 150;
    let currentPrice = basePrice;

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const change = (Math.random() - 0.5) * 5;
      currentPrice += change;
      
      data.push({
        date: date,
        open: currentPrice + (Math.random() - 0.5) * 2,
        high: currentPrice + Math.random() * 3,
        low: currentPrice - Math.random() * 3,
        close: currentPrice,
        volume: Math.floor(Math.random() * 50000000) + 10000000,
        adjustedClose: currentPrice
      });
    }

    return data;
  }

  private getMockMetrics(symbol: string): StockMetrics {
    return {
      symbol: symbol,
      marketCap: 2500000000000,
      peRatio: 28.5,
      eps: 5.25,
      dividendYield: 0.5,
      beta: 1.2,
      revenue: 394000000000,
      profitMargin: 25.3,
      roe: 147.5,
      debtToEquity: 0.5
    };
  }
}

