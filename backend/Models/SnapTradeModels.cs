namespace StockAnalyzer.Models;

public class SnapTradeUser
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string? Email { get; set; }
    public DateTime? CreatedAt { get; set; }
}

public class Brokerage
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public bool SupportsOAuth { get; set; }
}

public class Account
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string BrokerageId { get; set; } = string.Empty;
    public decimal? Balance { get; set; }
    public string Currency { get; set; } = "USD";
    public List<Holding> Holdings { get; set; } = new();
}

public class Holding
{
    public string Symbol { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal AveragePurchasePrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public decimal TotalValue { get; set; }
    public decimal GainLoss { get; set; }
    public decimal GainLossPercent { get; set; }
    public string Currency { get; set; } = "USD";
}

public class Portfolio
{
    public string UserId { get; set; } = string.Empty;
    public List<Account> Accounts { get; set; } = new();
    public decimal TotalBalance { get; set; }
    public decimal TotalGainLoss { get; set; }
    public decimal TotalGainLossPercent { get; set; }
    public string Currency { get; set; } = "USD";
}

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; }
    public List<string>? Errors { get; set; }
}

