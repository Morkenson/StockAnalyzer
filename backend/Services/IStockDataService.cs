using StockAnalyzer.Models;

namespace StockAnalyzer.Services;

public interface IStockDataService
{
    Task<List<StockSearchResult>> SearchStocksAsync(string query);
    Task<StockQuote?> GetStockQuoteAsync(string symbol);
    Task<StockDetails?> GetStockDetailsAsync(string symbol);
    Task<List<StockQuote>> GetMultipleStockQuotesAsync(List<string> symbols);
    Task<List<StockHistoricalData>> GetHistoricalDataAsync(string symbol, string interval = "1day", int? outputSize = null);
}

