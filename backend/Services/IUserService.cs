namespace StockAnalyzer.Services;

public interface IUserService
{
    Task<string?> GetUserSecretAsync(string userId);
    Task StoreUserSecretAsync(string userId, string userSecret);
}

