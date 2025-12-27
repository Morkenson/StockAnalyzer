using StockAnalyzer.Models;

namespace StockAnalyzer.Services;

public interface ISnapTradeService
{
    Task<SnapTradeUser> CreateUserAsync(string userId);
    Task<List<Brokerage>> GetBrokeragesAsync();
    Task<string> InitiateConnectionAsync(string userId, string userSecret, string redirectUri);
    Task<List<Account>> GetAccountsAsync(string userId, string userSecret);
    Task<List<Holding>> GetAccountHoldingsAsync(string userId, string userSecret, string accountId);
    Task<Portfolio> GetPortfolioAsync(string userId, string userSecret);
}

