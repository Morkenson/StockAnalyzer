import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { Stock, StockQuote, StockHistoricalData, StockSearchResult } from '../models/stock.model';
import { environment } from '../../environments/environment';

// Backend API Response Interface
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private apiUrl = environment.api.baseUrl;
  
  // Cache TTL in milliseconds
  private readonly CACHE_TTL_QUOTE = 60 * 1000; // 1 minute for quotes (fast-changing)
  private readonly CACHE_TTL_DETAILS = 5 * 60 * 1000; // 5 minutes for stock details
  private readonly CACHE_TTL_HISTORICAL = 15 * 60 * 1000; // 15 minutes for historical data
  
  // In-memory cache maps
  private quoteCache = new Map<string, CacheEntry<Observable<StockQuote>>>();
  private detailsCache = new Map<string, CacheEntry<Observable<Stock>>>();
  private historicalCache = new Map<string, CacheEntry<Observable<StockHistoricalData[]>>>();
  private multipleQuotesCache = new Map<string, CacheEntry<Observable<StockQuote[]>>>();

  constructor(private http: HttpClient) {
    // Clean up expired localStorage cache entries on service initialization
    this.cleanExpiredCache();
  }

  /**
   * Get cache key for localStorage
   */
  private getCacheKey(type: string, key: string): string {
    return `stock_cache_${type}_${key.toUpperCase()}`;
  }

  /**
   * Get data from localStorage cache
   */
  private getFromLocalCache<T>(cacheKey: string): T | null {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      
      // Check if expired
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Convert date strings back to Date objects
      if (entry.data && typeof entry.data === 'object') {
        const data = entry.data as any;
        if (data.timestamp && typeof data.timestamp === 'string') {
          data.timestamp = new Date(data.timestamp);
        }
        if (Array.isArray(data)) {
          return data.map(item => {
            if (item.timestamp && typeof item.timestamp === 'string') {
              item.timestamp = new Date(item.timestamp);
            }
            if (item.date && typeof item.date === 'string') {
              item.date = new Date(item.date);
            }
            return item;
          }) as any;
        }
      }

      return entry.data;
    } catch (error) {
      console.error('Error reading from cache:', error);
      localStorage.removeItem(cacheKey);
      return null;
    }
  }

  /**
   * Save data to localStorage cache
   */
  private saveToLocalCache<T>(cacheKey: string, data: T, ttl: number): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        expiresAt: Date.now() + ttl
      };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.error('Error saving to cache:', error);
      // If storage is full, try to clean up old entries
      this.cleanExpiredCache();
    }
  }

  private getMemoryCache<T>(cache: Map<string, CacheEntry<Observable<T>>>, key: string): Observable<T> | null {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private saveMemoryCache<T>(cache: Map<string, CacheEntry<Observable<T>>>, key: string, data: Observable<T>, ttl: number): void {
    cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
  }

  /**
   * Clean expired cache entries from localStorage
   */
  private cleanExpiredCache(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('stock_cache_')) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const entry: CacheEntry<any> = JSON.parse(cached);
              if (Date.now() > entry.expiresAt) {
                localStorage.removeItem(key);
              }
            }
          } catch (e) {
            // If we can't parse it, remove it
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning cache:', error);
    }
  }

  /**
   * Clear all cache (useful for debugging or forcing refresh)
   */
  clearCache(): void {
    this.quoteCache.clear();
    this.detailsCache.clear();
    this.historicalCache.clear();
    this.multipleQuotesCache.clear();
    
    // Clear localStorage cache
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('stock_cache_')) {
        localStorage.removeItem(key);
      }
    });
  }

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
   * Get stock details by symbol using backend API with caching
   */
  getStockDetails(symbol: string, forceRefresh: boolean = false): Observable<Stock> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const cacheKey = this.getCacheKey('details', normalizedSymbol);
    
    // Check localStorage cache first
    if (!forceRefresh) {
      const cached = this.getFromLocalCache<Stock>(cacheKey);
      if (cached) {
        return of(cached);
      }
    }

    // Check in-memory cache
    const memoryCached = !forceRefresh ? this.getMemoryCache(this.detailsCache, normalizedSymbol) : null;
    if (memoryCached) {
      return memoryCached;
    }

    // Fetch from API
    const observable = this.http.get<ApiResponse<any>>(`${this.apiUrl}/stock/details/${normalizedSymbol}`)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Stock details not found');
          }

          const details = response.data;
          const stock: Stock = {
            symbol: details.symbol,
            name: details.name || normalizedSymbol,
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
        tap(stock => {
          // Save to localStorage cache
          this.saveToLocalCache(cacheKey, stock, this.CACHE_TTL_DETAILS);
        }),
        shareReplay(1), // Cache in memory for current session
        catchError(error => {
          console.error('Error fetching stock details:', error);
          // Remove from cache on error
          this.detailsCache.delete(normalizedSymbol);
          localStorage.removeItem(cacheKey);
          return throwError(() => error);
        })
      );

    // Cache the observable
    this.saveMemoryCache(this.detailsCache, normalizedSymbol, observable, this.CACHE_TTL_DETAILS);
    
    return observable;
  }

  /**
   * Get real-time stock quote using backend API with caching
   */
  getStockQuote(symbol: string, forceRefresh: boolean = false): Observable<StockQuote> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const cacheKey = this.getCacheKey('quote', normalizedSymbol);
    
    // Check localStorage cache first
    if (!forceRefresh) {
      const cached = this.getFromLocalCache<StockQuote>(cacheKey);
      if (cached) {
        return of(cached);
      }
    }

    // Check in-memory cache
    const memoryCached = !forceRefresh ? this.getMemoryCache(this.quoteCache, normalizedSymbol) : null;
    if (memoryCached) {
      return memoryCached;
    }

    // Fetch from API
    const observable = this.http.get<ApiResponse<StockQuote>>(`${this.apiUrl}/stock/quote/${normalizedSymbol}`)
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
        tap(quote => {
          // Save to localStorage cache
          this.saveToLocalCache(cacheKey, quote, this.CACHE_TTL_QUOTE);
        }),
        shareReplay(1), // Cache in memory for current session
        catchError(error => {
          console.error('Error fetching stock quote:', error);
          // Remove from cache on error
          this.quoteCache.delete(normalizedSymbol);
          localStorage.removeItem(cacheKey);
          return throwError(() => error);
        })
      );

    // Cache the observable
    this.saveMemoryCache(this.quoteCache, normalizedSymbol, observable, this.CACHE_TTL_QUOTE);
    
    return observable;
  }

  /**
   * Get historical stock data using backend API with caching
   */
  getHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval: '1min' | '5min' | '15min' | '30min' | '1h' | '1d' | '1w' | '1m' = '1d',
    forceRefresh: boolean = false,
    outputSize?: number
  ): Observable<StockHistoricalData[]> {
    // Map interval to backend format
    const intervalMap: { [key: string]: string } = {
      '1min': '1min',
      '5min': '5min',
      '15min': '15min',
      '30min': '30min',
      '1h': '1h',
      '1d': '1day',
      '1w': '1week',
      '1m': '1month'
    };

    const backendInterval = intervalMap[interval] || '1day';
    const normalizedSymbol = symbol.trim().toUpperCase();
    const cacheKeyStr = `${normalizedSymbol}_${interval}_${outputSize || 'default'}`;
    const cacheKey = this.getCacheKey('historical', cacheKeyStr);
    
    // Check localStorage cache first
    if (!forceRefresh) {
      const cached = this.getFromLocalCache<StockHistoricalData[]>(cacheKey);
      if (cached) {
        return of(cached);
      }
    }

    // Check in-memory cache
    const memoryCached = !forceRefresh ? this.getMemoryCache(this.historicalCache, cacheKeyStr) : null;
    if (memoryCached) {
      return memoryCached;
    }

    let params = new HttpParams().set('interval', backendInterval);
    if (outputSize) {
      params = params.set('outputSize', String(outputSize));
    }

    // Fetch from API
    const observable = this.http.get<ApiResponse<StockHistoricalData[] | StockHistoricalData>>(`${this.apiUrl}/stock/historical/${normalizedSymbol}`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            return [];
          }
          
          // Handle both array and single object responses
          let dataArray: StockHistoricalData[];
          if (Array.isArray(response.data)) {
            dataArray = response.data;
          } else {
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
        tap(data => {
          // Save to localStorage cache
          this.saveToLocalCache(cacheKey, data, this.CACHE_TTL_HISTORICAL);
        }),
        shareReplay(1), // Cache in memory for current session
        catchError(error => {
          console.error('Error fetching historical data:', error);
          // Remove from cache on error
          this.historicalCache.delete(cacheKeyStr);
          localStorage.removeItem(cacheKey);
          return of([]);
        })
      );

    // Cache the observable
    this.saveMemoryCache(this.historicalCache, cacheKeyStr, observable, this.CACHE_TTL_HISTORICAL);
    
    return observable;
  }

  /**
   * Get multiple stock quotes at once using backend API with caching
   */
  getMultipleQuotes(symbols: string[], forceRefresh: boolean = false): Observable<StockQuote[]> {
    if (symbols.length === 0) {
      return of([]);
    }

    // Create a sorted cache key for consistent caching
    const normalizedSymbols = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))];
    if (normalizedSymbols.length === 0) {
      return of([]);
    }

    const sortedSymbols = [...normalizedSymbols].sort().join(',');
    const cacheKey = this.getCacheKey('quotes', sortedSymbols);
    
    // Check localStorage cache first
    if (!forceRefresh) {
      const cached = this.getFromLocalCache<StockQuote[]>(cacheKey);
      if (cached) {
        return of(cached);
      }
    }

    // Check in-memory cache
    const memoryCached = !forceRefresh ? this.getMemoryCache(this.multipleQuotesCache, sortedSymbols) : null;
    if (memoryCached) {
      return memoryCached;
    }

    // Fetch from API
    const observable = this.http.post<ApiResponse<StockQuote[]>>(`${this.apiUrl}/stock/quotes`, normalizedSymbols)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            return normalizedSymbols.map(symbol => ({
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
        tap(quotes => {
          // Save to localStorage cache
          this.saveToLocalCache(cacheKey, quotes, this.CACHE_TTL_QUOTE);
        }),
        shareReplay(1), // Cache in memory for current session
        catchError(error => {
          console.error('Error fetching multiple quotes:', error);
          // Remove from cache on error
          this.multipleQuotesCache.delete(sortedSymbols);
          localStorage.removeItem(cacheKey);
          // Return empty quotes for all symbols on error
          return of(normalizedSymbols.map(symbol => ({
            symbol: symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            timestamp: new Date()
          })));
        })
      );

    // Cache the observable
    this.saveMemoryCache(this.multipleQuotesCache, sortedSymbols, observable, this.CACHE_TTL_QUOTE);
    
    return observable;
  }
}
