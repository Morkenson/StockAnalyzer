namespace StockAnalyzer.Api.Services;

public interface IUserService
{
    Task<string?> GetUserSecretAsync(string userId);
    Task StoreUserSecretAsync(string userId, string userSecret);
    Task<bool> UserExistsAsync(string userId);
}

