import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Stock, StockQuote, StockHistoricalData, StockSearchResult, StockMetrics } from '../models/stock.model';
import { environment } from '../../environments/environment';

// Backend API Response Interface
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private apiUrl = environment.api.baseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Search for stocks by symbol or name using backend API
   */
  searchStocks(query: string): Observable<StockSearchResult[]> {
    if (!query || query.trim().length === 0) {
      return of([]);
    }

    const params = new HttpParams().set('query', query);

    return this.http.get<ApiResponse<StockSearchResult[]>>(`${this.apiUrl}/stock/search`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            return [];
          }
          // Limit to top 5 most likely results
          return response.data.slice(0, 5);
        }),
        catchError(error => {
          console.error('Error searching stocks:', error);
          return of([]);
        })
      );
  }

  /**
   * Get stock details by symbol using backend API
   */
  getStockDetails(symbol: string): Observable<Stock> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/stock/details/${symbol}`)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Stock details not found');
          }

          const details = response.data;
          const stock: Stock = {
            symbol: details.symbol,
            name: details.name || symbol,
            exchange: details.exchange || 'Unknown',
            currentPrice: details.currentPrice || 0,
            previousClose: details.previousClose,
            change: details.change,
            changePercent: details.changePercent,
            volume: details.volume,
            sector: details.sector,
            industry: details.industry,
            marketCap: details.marketCap,
            peRatio: details.peRatio,
            dividendYield: details.dividendYield,
            high52Week: details.high52Week,
            low52Week: details.low52Week,
            averageVolume: details.averageVolume,
            description: details.description
          };

          return stock;
        }),
        catchError(error => {
          console.error('Error fetching stock details:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get real-time stock quote using backend API
   */
  getStockQuote(symbol: string): Observable<StockQuote> {
    return this.http.get<ApiResponse<StockQuote>>(`${this.apiUrl}/stock/quote/${symbol}`)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Stock quote not found');
          }
          return {
            ...response.data,
            timestamp: new Date(response.data.timestamp)
          };
        }),
        catchError(error => {
          console.error('Error fetching stock quote:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get historical stock data using backend API
   * Note: This is a simplified version - you may need to extend the backend endpoint
   * to support date ranges and intervals
   */
  getHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval: '1d' | '1w' | '1m' = '1d'
  ): Observable<StockHistoricalData[]> {
    // Map interval to backend format
    const intervalMap: { [key: string]: string } = {
      '1d': '1day',
      '1w': '1week',
      '1m': '1month'
    };

    const backendInterval = intervalMap[interval] || '1day';
    const params = new HttpParams()
      .set('interval', backendInterval);

    return this.http.get<ApiResponse<StockHistoricalData[] | StockHistoricalData>>(`${this.apiUrl}/stock/historical/${symbol}`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            return [];
          }
          
          // Handle both array and single object responses (for backward compatibility)
          let dataArray: StockHistoricalData[];
          if (Array.isArray(response.data)) {
            dataArray = response.data;
          } else {
            // If it's a single object, wrap it in an array
            dataArray = [response.data as StockHistoricalData];
          }
          
          if (dataArray.length === 0) {
            return [];
          }
          
          // Convert date strings to Date objects
          return dataArray.map(item => ({
            ...item,
            date: item.date instanceof Date ? item.date : new Date(item.date)
          }));
        }),
        catchError(error => {
          console.error('Error fetching historical data:', error);
          return of([]);
        })
      );
  }

  /**
   * Get stock metrics using backend API
   * Note: This uses stock details endpoint - you may want to create a dedicated metrics endpoint
   */
  getStockMetrics(symbol: string): Observable<StockMetrics> {
    return this.getStockDetails(symbol).pipe(
      map(stock => {
        // Convert stock details to metrics format (only fields available in free plan)
        const metrics: StockMetrics = {
          symbol: stock.symbol,
          marketCap: stock.marketCap || 0,
          peRatio: stock.peRatio || 0,
          dividendYield: stock.dividendYield || 0
        };
        return metrics;
      }),
      catchError(error => {
        console.error('Error fetching stock metrics:', error);
        // Return default metrics on error
        return of({
          symbol: symbol,
          marketCap: 0,
          peRatio: 0,
          dividendYield: 0
        });
      })
    );
  }

  /**
   * Get multiple stock quotes at once using backend API
   */
  getMultipleQuotes(symbols: string[]): Observable<StockQuote[]> {
    if (symbols.length === 0) {
      return of([]);
    }

    return this.http.post<ApiResponse<StockQuote[]>>(`${this.apiUrl}/stock/quotes`, symbols)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            return symbols.map(symbol => ({
              symbol: symbol,
              price: 0,
              change: 0,
              changePercent: 0,
              volume: 0,
              timestamp: new Date()
            }));
          }
          return response.data.map(quote => ({
            ...quote,
            timestamp: new Date(quote.timestamp)
          }));
        }),
        catchError(error => {
          console.error('Error fetching multiple quotes:', error);
          // Return empty quotes for all symbols on error
          return of(symbols.map(symbol => ({
            symbol: symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            timestamp: new Date()
          })));
        })
      );
  }
}
