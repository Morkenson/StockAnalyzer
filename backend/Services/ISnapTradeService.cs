using StockAnalyzer.Models;

namespace StockAnalyzer.Services;

public interface ISnapTradeService
{
    Task<SnapTradeUser> CreateUserAsync(string userId);
    Task<SnapTradeUser?> GetUserAsync(string userId, string userSecret);
    Task<List<Brokerage>> GetBrokeragesAsync();
    Task<string> InitiateConnectionAsync(string userId, string userSecret, string redirectUri);
    Task<List<Account>> GetAccountsAsync(string userId, string userSecret);
    Task<Account?> GetAccountAsync(string userId, string userSecret, string accountId);
    Task<AccountBalance> GetAccountBalanceAsync(string userId, string userSecret, string accountId);
    Task<List<Holding>> GetAccountHoldingsAsync(string userId, string userSecret, string accountId);
    Task<Portfolio> GetPortfolioAsync(string userId, string userSecret);
    Task<TradeExecution> PlaceTradeAsync(string userId, string userSecret, string accountId, TradeOrder order);
    Task<TradeExecution?> GetTradeStatusAsync(string userId, string userSecret, string accountId, string tradeId);
}

