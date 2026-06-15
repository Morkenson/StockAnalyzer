import { firstValueFrom, of, throwError } from 'rxjs';

import { StockService } from '../../app/services/stock.service';

describe('StockService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('searchStocks', () => {
    it('returns an empty list for blank queries without calling the API', async () => {
      const http = { get: jest.fn() };
      const service = new StockService(http as any);

      await expect(firstValueFrom(service.searchStocks('   '))).resolves.toEqual([]);
      expect(http.get).not.toHaveBeenCalled();
    });

    it('passes the query param and limits results to the top 5', async () => {
      const results = Array.from({ length: 7 }, (_, i) => ({
        symbol: `S${i}`,
        name: `Stock ${i}`,
        exchange: 'NYSE',
        type: 'stock'
      }));
      const http = { get: jest.fn().mockReturnValue(of({ success: true, data: results })) };
      const service = new StockService(http as any);

      const found = await firstValueFrom(service.searchStocks('sto'));

      expect(found).toHaveLength(5);
      const [url, options] = http.get.mock.calls[0];
      expect(url).toContain('/stock/search');
      expect(options.params.get('query')).toBe('sto');
    });

    it('returns an empty list on unsuccessful responses', async () => {
      const http = { get: jest.fn().mockReturnValue(of({ success: false })) };
      const service = new StockService(http as any);

      await expect(firstValueFrom(service.searchStocks('sto'))).resolves.toEqual([]);
    });

    it('swallows http errors and returns an empty list', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const http = { get: jest.fn().mockReturnValue(throwError(() => new Error('boom'))) };
      const service = new StockService(http as any);

      await expect(firstValueFrom(service.searchStocks('sto'))).resolves.toEqual([]);
      errorSpy.mockRestore();
    });
  });

  describe('getStockDetails', () => {
    const details = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      currentPrice: 200,
      sector: 'Technology'
    };

    it('maps details and applies defaults for missing fields', async () => {
      const http = { get: jest.fn().mockReturnValue(of({ success: true, data: { symbol: 'MSFT' } })) };
      const service = new StockService(http as any);

      const stock = await firstValueFrom(service.getStockDetails('msft'));

      expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/stock/details/MSFT'));
      expect(stock.name).toBe('MSFT');
      expect(stock.exchange).toBe('Unknown');
      expect(stock.currentPrice).toBe(0);
    });

    it('serves repeat requests from cache', async () => {
      const http = { get: jest.fn().mockReturnValue(of({ success: true, data: details })) };
      const service = new StockService(http as any);

      await firstValueFrom(service.getStockDetails('AAPL'));
      const second = await firstValueFrom(service.getStockDetails('aapl'));

      expect(second.symbol).toBe('AAPL');
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('stock_cache_details_AAPL')).toContain('Apple Inc.');
    });

    it('bypasses the cache when forceRefresh is set', async () => {
      const http = { get: jest.fn().mockReturnValue(of({ success: true, data: details })) };
      const service = new StockService(http as any);

      await firstValueFrom(service.getStockDetails('AAPL'));
      await firstValueFrom(service.getStockDetails('AAPL', true));

      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it('throws the API message and clears the cache on failure', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const http = { get: jest.fn().mockReturnValue(of({ success: false, message: 'not found' })) };
      const service = new StockService(http as any);

      await expect(firstValueFrom(service.getStockDetails('NOPE'))).rejects.toThrow('not found');
      expect(localStorage.getItem('stock_cache_details_NOPE')).toBeNull();
      errorSpy.mockRestore();
    });
  });

  describe('getStockQuote', () => {
    const quoteData = {
      symbol: 'AAPL',
      price: 201.5,
      change: 1.5,
      changePercent: 0.75,
      volume: 1000000,
      timestamp: '2026-06-09T15:30:00.000Z'
    };

    it('converts the timestamp to a Date and caches the quote', async () => {
      const http = { get: jest.fn().mockReturnValue(of({ success: true, data: quoteData })) };
      const service = new StockService(http as any);

      const quote = await firstValueFrom(service.getStockQuote('aapl'));

      expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/stock/quote/AAPL'));
      expect(quote.price).toBe(201.5);
      expect(quote.timestamp).toEqual(new Date(quoteData.timestamp));
      expect(localStorage.getItem('stock_cache_quote_AAPL')).toContain('201.5');

      const cached = await firstValueFrom(service.getStockQuote('AAPL'));
      expect(cached.timestamp).toBeInstanceOf(Date);
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('rethrows http errors', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const http = { get: jest.fn().mockReturnValue(throwError(() => new Error('offline'))) };
      const service = new StockService(http as any);

      await expect(firstValueFrom(service.getStockQuote('AAPL'))).rejects.toThrow('offline');
      errorSpy.mockRestore();
    });
  });

  describe('getHistoricalData', () => {
    const bar = {
      date: '2026-06-01',
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100
    };

    it('maps the interval, passes outputSize and converts dates', async () => {
      const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [bar] })) };
      const service = new StockService(http as any);

      const data = await firstValueFrom(
        service.getHistoricalData('aapl', new Date('2026-01-01'), new Date('2026-06-01'), '1w', false, 30)
      );

      const [url, options] = http.get.mock.calls[0];
      expect(url).toContain('/stock/historical/AAPL');
      expect(options.params.get('interval')).toBe('1week');
      expect(options.params.get('outputSize')).toBe('30');
      expect(data).toHaveLength(1);
      expect(data[0].date).toBeInstanceOf(Date);
      expect(data[0].close).toBe(1.5);
    });

    it('wraps a single-object response in an array', async () => {
      const http = { get: jest.fn().mockReturnValue(of({ success: true, data: bar })) };
      const service = new StockService(http as any);

      const data = await firstValueFrom(
        service.getHistoricalData('AAPL', new Date('2026-01-01'), new Date('2026-06-01'))
      );

      expect(data).toHaveLength(1);
      expect(http.get.mock.calls[0][1].params.get('interval')).toBe('1day');
    });

    it('returns an empty array when the API fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const http = { get: jest.fn().mockReturnValue(throwError(() => new Error('boom'))) };
      const service = new StockService(http as any);

      const data = await firstValueFrom(
        service.getHistoricalData('AAPL', new Date('2026-01-01'), new Date('2026-06-01'))
      );

      expect(data).toEqual([]);
      errorSpy.mockRestore();
    });
  });

  describe('getMultipleQuotes', () => {
    const quotes = [
      { symbol: 'AAPL', price: 200, change: 1, changePercent: 0.5, volume: 10, timestamp: '2026-06-09T15:30:00.000Z' },
      { symbol: 'MSFT', price: 400, change: 2, changePercent: 0.5, volume: 20, timestamp: '2026-06-09T15:30:00.000Z' }
    ];

    it('returns an empty list for empty or blank symbol input without calling the API', async () => {
      const http = { post: jest.fn() };
      const service = new StockService(http as any);

      await expect(firstValueFrom(service.getMultipleQuotes([]))).resolves.toEqual([]);
      await expect(firstValueFrom(service.getMultipleQuotes(['   ']))).resolves.toEqual([]);
      expect(http.post).not.toHaveBeenCalled();
    });

    it('dedupes and uppercases symbols and converts timestamps', async () => {
      const http = { post: jest.fn().mockReturnValue(of({ success: true, data: quotes })) };
      const service = new StockService(http as any);

      const result = await firstValueFrom(service.getMultipleQuotes(['aapl', 'AAPL', ' msft ']));

      expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/stock/quotes'), ['AAPL', 'MSFT']);
      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toEqual(new Date(quotes[0].timestamp));
    });

    it('returns zeroed quotes when the response is unsuccessful', async () => {
      const http = { post: jest.fn().mockReturnValue(of({ success: false })) };
      const service = new StockService(http as any);

      const result = await firstValueFrom(service.getMultipleQuotes(['aapl']));

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ symbol: 'AAPL', price: 0, change: 0, changePercent: 0, volume: 0 });
    });

    it('returns zeroed quotes when the API call fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const http = { post: jest.fn().mockReturnValue(throwError(() => new Error('boom'))) };
      const service = new StockService(http as any);

      const result = await firstValueFrom(service.getMultipleQuotes(['aapl', 'msft']));

      expect(result.map(q => q.symbol)).toEqual(['AAPL', 'MSFT']);
      expect(result.every(q => q.price === 0)).toBe(true);
      errorSpy.mockRestore();
    });
  });

  describe('clearCache', () => {
    it('removes cached entries and forces fresh fetches', async () => {
      const details = { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', currentPrice: 200 };
      const http = { get: jest.fn().mockReturnValue(of({ success: true, data: details })) };
      const service = new StockService(http as any);

      await firstValueFrom(service.getStockDetails('AAPL'));
      expect(localStorage.getItem('stock_cache_details_AAPL')).not.toBeNull();

      service.clearCache();

      expect(localStorage.getItem('stock_cache_details_AAPL')).toBeNull();
      await firstValueFrom(service.getStockDetails('AAPL'));
      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it('cleans expired localStorage entries on construction', () => {
      localStorage.setItem('stock_cache_details_OLD', JSON.stringify({ data: {}, expiresAt: Date.now() - 1000 }));
      localStorage.setItem('stock_cache_details_BAD', 'not-json');

      new StockService({ get: jest.fn() } as any);

      expect(localStorage.getItem('stock_cache_details_OLD')).toBeNull();
      expect(localStorage.getItem('stock_cache_details_BAD')).toBeNull();
    });
  });
});
