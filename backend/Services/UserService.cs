namespace StockAnalyzer.Services;

public class UserService : IUserService
{
    // TODO: Replace with actual database storage
    // For now, using in-memory dictionary (NOT for production!)
    private static readonly Dictionary<string, string> _userSecrets = new();

    public Task<string?> GetUserSecretAsync(string userId)
    {
        _userSecrets.TryGetValue(userId, out var secret);
        return Task.FromResult<string?>(secret);
    }

    public Task StoreUserSecretAsync(string userId, string userSecret)
    {
        _userSecrets[userId] = userSecret;
        return Task.CompletedTask;
    }
}

