using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using StockAnalyzer.Models;

namespace StockAnalyzer.Services;

public class SnapTradeService : ISnapTradeService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SnapTradeService> _logger;

    public SnapTradeService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<SnapTradeService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<SnapTradeUser> CreateUserAsync(string userId)
    {
        try
        {
            var body = new { userId = userId };
            var response = await _httpClient.PostAsJsonAsync("/snapTrade/v1/register", body);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            return new SnapTradeUser
            {
                Id = result.GetProperty("id").GetString() ?? "",
                UserId = userId,
                Email = result.TryGetProperty("email", out var email) ? email.GetString() : null,
                CreatedAt = result.TryGetProperty("createdAt", out var createdAt) 
                    ? createdAt.GetDateTime() 
                    : DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating SnapTrade user for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<SnapTradeUser?> GetUserAsync(string userId, string userSecret)
    {
        try
        {
            var queryParams = $"?userId={Uri.EscapeDataString(userId)}&userSecret={Uri.EscapeDataString(userSecret)}";
            var response = await _httpClient.GetAsync($"/snapTrade/v1/users{queryParams}");
            
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<JsonElement>();
                return new SnapTradeUser
                {
                    Id = result.GetProperty("id").GetString() ?? "",
                    UserId = userId,
                    Email = result.TryGetProperty("email", out var email) ? email.GetString() : null
                };
            }
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching SnapTrade user for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<List<Brokerage>> GetBrokeragesAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/snapTrade/v1/brokerages");
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var brokerages = new List<Brokerage>();

            if (result.TryGetProperty("brokerages", out var brokeragesElement))
            {
                foreach (var brokerage in brokeragesElement.EnumerateArray())
                {
                    brokerages.Add(new Brokerage
                    {
                        Id = brokerage.GetProperty("id").GetString() ?? "",
                        Name = brokerage.GetProperty("name").GetString() ?? "",
                        DisplayName = brokerage.TryGetProperty("displayName", out var dn) ? dn.GetString() : null,
                        SupportsOAuth = brokerage.TryGetProperty("supportsOAuth", out var oauth) && oauth.GetBoolean()
                    });
                }
            }

            return brokerages;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching brokerages");
            throw;
        }
    }

    public async Task<string> InitiateConnectionAsync(string userId, string userSecret, string redirectUri)
    {
        try
        {
            var body = new
            {
                userId = userId,
                userSecret = userSecret,
                redirectUri = redirectUri
            };

            var response = await _httpClient.PostAsJsonAsync("/snapTrade/v1/auth/login", body);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            return result.TryGetProperty("loginLink", out var loginLink)
                ? loginLink.GetString() ?? ""
                : result.TryGetProperty("redirectUri", out var redirect)
                    ? redirect.GetString() ?? ""
                    : "";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating connection for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<List<Account>> GetAccountsAsync(string userId, string userSecret)
    {
        try
        {
            var queryParams = $"?userId={Uri.EscapeDataString(userId)}&userSecret={Uri.EscapeDataString(userSecret)}";
            var response = await _httpClient.GetAsync($"/snapTrade/v1/accounts{queryParams}");
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var accounts = new List<Account>();

            if (result.TryGetProperty("accounts", out var accountsElement))
            {
                foreach (var account in accountsElement.EnumerateArray())
                {
                    accounts.Add(ParseAccount(account));
                }
            }
            else if (result.ValueKind == JsonValueKind.Array)
            {
                foreach (var account in result.EnumerateArray())
                {
                    accounts.Add(ParseAccount(account));
                }
            }

            return accounts;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching accounts for userId: {UserId}", userId);
            throw;
        }
    }

    public async Task<Account?> GetAccountAsync(string userId, string userSecret, string accountId)
    {
        try
        {
            var queryParams = $"?userId={Uri.EscapeDataString(userId)}&userSecret={Uri.EscapeDataString(userSecret)}";
            var response = await _httpClient.GetAsync($"/snapTrade/v1/accounts/{accountId}{queryParams}");
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            return ParseAccount(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching account {AccountId} for userId: {UserId}", accountId, userId);
            throw;
        }
    }

    public async Task<AccountBalance> GetAccountBalanceAsync(string userId, string userSecret, string accountId)
    {
        try
        {
            var queryParams = $"?userId={Uri.EscapeDataString(userId)}&userSecret={Uri.EscapeDataString(userSecret)}";
            var response = await _httpClient.GetAsync($"/snapTrade/v1/accounts/{accountId}/balances{queryParams}");
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            return new AccountBalance
            {
                AccountId = accountId,
                TotalCash = result.TryGetProperty("totalCash", out var cash) ? cash.GetDecimal() : 0,
                BuyingPower = result.TryGetProperty("buyingPower", out var buying) ? buying.GetDecimal() : 0,
                Currency = result.TryGetProperty("currency", out var currency) ? currency.GetString() ?? "USD" : "USD",
                Positions = result.TryGetProperty("positions", out var positions) ? positions.GetArrayLength() : 0
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching account balance for account {AccountId}", accountId);
            throw;
        }
    }

    public async Task<List<Holding>> GetAccountHoldingsAsync(string userId, string userSecret, string accountId)
    {
        try
        {
            var queryParams = $"?userId={Uri.EscapeDataString(userId)}&userSecret={Uri.EscapeDataString(userSecret)}";
            var response = await _httpClient.GetAsync($"/snapTrade/v1/accounts/{accountId}/holdings{queryParams}");
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var holdings = new List<Holding>();

            if (result.TryGetProperty("holdings", out var holdingsElement))
            {
                foreach (var holding in holdingsElement.EnumerateArray())
                {
                    holdings.Add(ParseHolding(holding));
                }
            }
            else if (result.TryGetProperty("positions", out var positionsElement))
            {
                foreach (var holding in positionsElement.EnumerateArray())
                {
                    holdings.Add(ParseHolding(holding));
                }
            }

            return holdings;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching holdings for account {AccountId}", accountId);
            throw;
        }
    }

    public async Task<Portfolio> GetPortfolioAsync(string userId, string userSecret)
    {
        var accounts = await GetAccountsAsync(userId, userSecret);
        
        // Load holdings for each account
        foreach (var account in accounts)
        {
            account.Holdings = await GetAccountHoldingsAsync(userId, userSecret, account.Id);
        }

        var totalBalance = accounts.Sum(a => a.Balance ?? 0);
        var totalGainLoss = accounts.Sum(a => a.Holdings.Sum(h => h.GainLoss));
        var totalGainLossPercent = totalBalance > 0 
            ? (totalGainLoss / (totalBalance - totalGainLoss)) * 100 
            : 0;

        return new Portfolio
        {
            UserId = userId,
            Accounts = accounts,
            TotalBalance = totalBalance,
            TotalGainLoss = totalGainLoss,
            TotalGainLossPercent = totalGainLossPercent,
            Currency = accounts.FirstOrDefault()?.Currency ?? "USD"
        };
    }

    public async Task<TradeExecution> PlaceTradeAsync(string userId, string userSecret, string accountId, TradeOrder order)
    {
        try
        {
            var body = new
            {
                userId = userId,
                userSecret = userSecret,
                accountId = accountId,
                symbol = order.Symbol,
                action = order.Action,
                units = order.Quantity,
                orderType = order.OrderType,
                timeInForce = order.TimeInForce,
                price = order.LimitPrice,
                stop = order.StopPrice
            };

            var response = await _httpClient.PostAsJsonAsync("/snapTrade/v1/trade/place", body);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            return ParseTradeExecution(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error placing trade for account {AccountId}", accountId);
            throw;
        }
    }

    public async Task<TradeExecution?> GetTradeStatusAsync(string userId, string userSecret, string accountId, string tradeId)
    {
        try
        {
            var queryParams = $"?userId={Uri.EscapeDataString(userId)}&userSecret={Uri.EscapeDataString(userSecret)}";
            var response = await _httpClient.GetAsync($"/snapTrade/v1/trade/{tradeId}{queryParams}");
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            return ParseTradeExecution(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trade status for trade {TradeId}", tradeId);
            throw;
        }
    }

    private Account ParseAccount(JsonElement element)
    {
        return new Account
        {
            Id = element.GetProperty("id").GetString() ?? "",
            Name = element.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "",
            AccountNumber = element.TryGetProperty("accountNumber", out var accNum) ? accNum.GetString() ?? "" : "",
            Type = element.TryGetProperty("type", out var type) ? type.GetString() ?? "" : "",
            BrokerageId = element.TryGetProperty("brokerageId", out var brokerId) ? brokerId.GetString() ?? "" : "",
            Balance = element.TryGetProperty("balance", out var balance) ? balance.GetDecimal() : null,
            Currency = element.TryGetProperty("currency", out var currency) ? currency.GetString() ?? "USD" : "USD"
        };
    }

    private Holding ParseHolding(JsonElement element)
    {
        var quantity = element.TryGetProperty("quantity", out var qty) ? qty.GetDecimal() : 0;
        var avgPrice = element.TryGetProperty("averagePurchasePrice", out var avg) ? avg.GetDecimal() : 0;
        var currentPrice = element.TryGetProperty("currentPrice", out var curr) ? curr.GetDecimal() : 0;
        var totalValue = element.TryGetProperty("totalValue", out var total) ? total.GetDecimal() : (quantity * currentPrice);
        var gainLoss = totalValue - (quantity * avgPrice);
        var gainLossPercent = (quantity * avgPrice) > 0 ? (gainLoss / (quantity * avgPrice)) * 100 : 0;

        return new Holding
        {
            Symbol = element.TryGetProperty("symbol", out var symbol) ? symbol.GetString() ?? "" : "",
            Quantity = quantity,
            AveragePurchasePrice = avgPrice,
            CurrentPrice = currentPrice,
            TotalValue = totalValue,
            GainLoss = gainLoss,
            GainLossPercent = gainLossPercent,
            Currency = element.TryGetProperty("currency", out var currency) ? currency.GetString() ?? "USD" : "USD"
        };
    }

    private TradeExecution ParseTradeExecution(JsonElement element)
    {
        return new TradeExecution
        {
            Id = element.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
            AccountId = element.TryGetProperty("accountId", out var accId) ? accId.GetString() ?? "" : "",
            Symbol = element.TryGetProperty("symbol", out var symbol) ? symbol.GetString() ?? "" : "",
            Action = element.TryGetProperty("action", out var action) ? action.GetString() ?? "" : "",
            Quantity = element.TryGetProperty("quantity", out var qty) ? qty.GetDecimal() : 0,
            Price = element.TryGetProperty("price", out var price) ? price.GetDecimal() : 0,
            Status = element.TryGetProperty("status", out var status) ? status.GetString() ?? "" : "",
            ExecutedAt = element.TryGetProperty("executedAt", out var exec) 
                ? exec.GetDateTime() 
                : DateTime.UtcNow
        };
    }
}

