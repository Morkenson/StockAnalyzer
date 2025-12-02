using System.Net.Http.Json;
using System.Text.Json;
using StockAnalyzer.Api.Models;

namespace StockAnalyzer.Api.Services;

public class StockDataService : IStockDataService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<StockDataService> _logger;
    private readonly string _apiKey;
    private readonly string _apiUrl;

    public StockDataService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<StockDataService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
        
        // Get API key from environment variable or configuration
        _apiKey = Environment.GetEnvironmentVariable("TWELVE_DATA_API_KEY") 
            ?? _configuration["TwelveData:ApiKey"] 
            ?? "";
        
        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("Twelve Data API key not found. Set TWELVE_DATA_API_KEY environment variable or configure in appsettings.json");
        }
        else
        {
            _logger.LogInformation("Twelve Data API key loaded successfully (length: {Length})", _apiKey.Length);
        }
        
        _apiUrl = _configuration["TwelveData:ApiUrl"] ?? "https://api.twelvedata.com";
    }

    public async Task<List<StockSearchResult>> SearchStocksAsync(string query)
    {
        try
        {
            var url = $"{_apiUrl}/symbol_search?symbol={Uri.EscapeDataString(query)}&apikey={_apiKey}";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var searchResults = new List<StockSearchResult>();

            if (result.TryGetProperty("data", out var dataElement) && dataElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in dataElement.EnumerateArray())
                {
                    searchResults.Add(new StockSearchResult
                    {
                        Symbol = item.TryGetProperty("symbol", out var symbol) ? symbol.GetString() ?? "" : "",
                        Name = item.TryGetProperty("instrument_name", out var name) ? name.GetString() ?? "" : "",
                        Exchange = item.TryGetProperty("exchange", out var exchange) ? exchange.GetString() ?? "" : "",
                        Type = item.TryGetProperty("instrument_type", out var type) ? type.GetString() ?? "" : ""
                    });
                }
            }

            return searchResults;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching stocks for query: {Query}", query);
            throw;
        }
    }

    public async Task<StockQuote?> GetStockQuoteAsync(string symbol)
    {
        try
        {
            var url = $"{_apiUrl}/quote?symbol={Uri.EscapeDataString(symbol)}&apikey={_apiKey}";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            
            if (result.TryGetProperty("status", out var status) && status.GetString() == "error")
            {
                return null;
            }

            var price = result.TryGetProperty("close", out var close) ? decimal.Parse(close.GetString() ?? "0") : 0;
            var previousClose = result.TryGetProperty("previous_close", out var prevClose) ? decimal.Parse(prevClose.GetString() ?? "0") : price;
            var change = result.TryGetProperty("change", out var changeProp) ? decimal.Parse(changeProp.GetString() ?? "0") : (price - previousClose);
            var changePercent = result.TryGetProperty("percent_change", out var changePct) ? decimal.Parse(changePct.GetString() ?? "0") : (previousClose != 0 ? (change / previousClose) * 100 : 0);
            var volume = result.TryGetProperty("volume", out var vol) ? long.Parse(vol.GetString() ?? "0") : 0;

            return new StockQuote
            {
                Symbol = result.TryGetProperty("symbol", out var sym) ? sym.GetString() ?? symbol : symbol,
                Price = price,
                Change = change,
                ChangePercent = changePercent,
                Volume = volume,
                Timestamp = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting stock quote for symbol: {Symbol}", symbol);
            throw;
        }
    }

    public async Task<StockDetails?> GetStockDetailsAsync(string symbol)
    {
        try
        {
            // Fetch both quote and profile data
            var quoteTask = GetStockQuoteAsync(symbol);
            var profileUrl = $"{_apiUrl}/profile?symbol={Uri.EscapeDataString(symbol)}&apikey={_apiKey}";
            var profileResponse = await _httpClient.GetAsync(profileUrl);
            
            var quote = await quoteTask;
            if (quote == null)
            {
                return null;
            }

            var details = new StockDetails
            {
                Symbol = quote.Symbol,
                CurrentPrice = quote.Price,
                Change = quote.Change,
                ChangePercent = quote.ChangePercent,
                Volume = quote.Volume
            };

            if (profileResponse.IsSuccessStatusCode)
            {
                var profile = await profileResponse.Content.ReadFromJsonAsync<JsonElement>();
                
                // Check if the response contains an error (even with 200 status)
                if (profile.TryGetProperty("status", out var status) && status.GetString() == "error")
                {
                    var errorMessage = profile.TryGetProperty("message", out var msg) ? msg.GetString() : "Unknown error";
                    _logger.LogWarning("Profile API returned error for symbol: {Symbol}. Message: {Message}", symbol, errorMessage);
                    // Profile endpoint requires paid plan - skip parsing profile data
                }
                else
                {
                    _logger.LogInformation("Profile data parsed successfully for symbol: {Symbol}", symbol);
                    
                    // Basic information
                details.Name = profile.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "";
                details.Exchange = profile.TryGetProperty("exchange", out var exchange) ? exchange.GetString() ?? "" : "";
                details.Sector = profile.TryGetProperty("sector", out var sector) ? sector.GetString() : null;
                details.Industry = profile.TryGetProperty("industry", out var industry) ? industry.GetString() : null;
                details.Description = profile.TryGetProperty("description", out var desc) ? desc.GetString() : null;
                
                // Market capitalization
                if (profile.TryGetProperty("market_capitalization", out var mcap))
                {
                    if (mcap.ValueKind == JsonValueKind.String)
                    {
                        var mcapStr = mcap.GetString();
                        if (!string.IsNullOrEmpty(mcapStr) && decimal.TryParse(mcapStr, out var mcapValue))
                        {
                            details.MarketCap = mcapValue;
                        }
                    }
                    else if (mcap.ValueKind == JsonValueKind.Number)
                    {
                        details.MarketCap = mcap.GetDecimal();
                    }
                }
                
                // P/E Ratio
                if (profile.TryGetProperty("pe_ratio", out var pe))
                {
                    if (pe.ValueKind == JsonValueKind.String)
                    {
                        var peStr = pe.GetString();
                        if (!string.IsNullOrEmpty(peStr) && decimal.TryParse(peStr, out var peValue))
                        {
                            details.PeRatio = peValue;
                        }
                    }
                    else if (pe.ValueKind == JsonValueKind.Number)
                    {
                        details.PeRatio = pe.GetDecimal();
                    }
                }
                
                // Dividend Yield
                if (profile.TryGetProperty("dividend_yield", out var divYield))
                {
                    if (divYield.ValueKind == JsonValueKind.String)
                    {
                        var divStr = divYield.GetString();
                        if (!string.IsNullOrEmpty(divStr) && decimal.TryParse(divStr, out var divValue))
                        {
                            details.DividendYield = divValue;
                        }
                    }
                    else if (divYield.ValueKind == JsonValueKind.Number)
                    {
                        details.DividendYield = divYield.GetDecimal();
                    }
                }
                
                // 52 Week High
                if (profile.TryGetProperty("52_week_high", out var high52) || profile.TryGetProperty("fifty_two_week_high", out high52))
                {
                    if (high52.ValueKind == JsonValueKind.String)
                    {
                        var highStr = high52.GetString();
                        if (!string.IsNullOrEmpty(highStr) && decimal.TryParse(highStr, out var highValue))
                        {
                            details.High52Week = highValue;
                        }
                    }
                    else if (high52.ValueKind == JsonValueKind.Number)
                    {
                        details.High52Week = high52.GetDecimal();
                    }
                }
                
                // 52 Week Low
                if (profile.TryGetProperty("52_week_low", out var low52) || profile.TryGetProperty("fifty_two_week_low", out low52))
                {
                    if (low52.ValueKind == JsonValueKind.String)
                    {
                        var lowStr = low52.GetString();
                        if (!string.IsNullOrEmpty(lowStr) && decimal.TryParse(lowStr, out var lowValue))
                        {
                            details.Low52Week = lowValue;
                        }
                    }
                    else if (low52.ValueKind == JsonValueKind.Number)
                    {
                        details.Low52Week = low52.GetDecimal();
                    }
                }
                
                // Average Volume
                if (profile.TryGetProperty("average_volume", out var avgVol))
                {
                    if (avgVol.ValueKind == JsonValueKind.String)
                    {
                        var avgVolStr = avgVol.GetString();
                        if (!string.IsNullOrEmpty(avgVolStr) && long.TryParse(avgVolStr, out var avgVolValue))
                        {
                            details.AverageVolume = avgVolValue;
                        }
                    }
                    else if (avgVol.ValueKind == JsonValueKind.Number)
                    {
                        details.AverageVolume = (long)avgVol.GetInt64();
                    }
                }
                }
            }
            else
            {
                var errorContent = await profileResponse.Content.ReadAsStringAsync();
                _logger.LogWarning("Profile API call failed for symbol: {Symbol}. Status: {Status}, Response: {Response}", 
                    symbol, profileResponse.StatusCode, errorContent);
            }
            
            // Try to get 52-week high/low from historical data if profile is not available
            // Note: Free plan may limit historical data, so try smaller ranges first
            if (details.High52Week == null || details.Low52Week == null)
            {
                _logger.LogInformation("Attempting to get 52-week high/low from historical data for symbol: {Symbol}", symbol);
                try
                {
                    // Try with available data (free plan typically allows up to 30 days)
                    // We'll use whatever data is available to calculate the range
                    var historicalData = await GetHistoricalDataAsync(symbol, "1day", 30);
                    _logger.LogInformation("Historical data retrieved. Count: {Count}", historicalData?.Count ?? 0);
                    
                    if (historicalData != null && historicalData.Count > 0)
                    {
                        details.High52Week = historicalData.Max(d => d.High);
                        details.Low52Week = historicalData.Min(d => d.Low);
                        _logger.LogInformation("Calculated high/low from historical data for symbol: {Symbol}. High: {High}, Low: {Low} (based on {Days} days)", 
                            symbol, details.High52Week, details.Low52Week, historicalData.Count);
                    }
                    else
                    {
                        _logger.LogWarning("Historical data is null or empty for symbol: {Symbol}. Free plan may limit historical data access.", symbol);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to get 52-week high/low from historical data for symbol: {Symbol}", symbol);
                }
            }

            return details;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting stock details for symbol: {Symbol}", symbol);
            throw;
        }
    }

    public async Task<List<StockQuote>> GetMultipleStockQuotesAsync(List<string> symbols)
    {
        try
        {
            var symbolsParam = string.Join(",", symbols);
            var url = $"{_apiUrl}/quote?symbol={Uri.EscapeDataString(symbolsParam)}&apikey={_apiKey}";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var quotes = new List<StockQuote>();

            // Twelve Data returns multiple quotes as an object with symbol keys
            if (result.ValueKind == JsonValueKind.Object)
            {
                foreach (var symbol in symbols)
                {
                    if (result.TryGetProperty(symbol, out var quoteElement))
                    {
                        var price = quoteElement.TryGetProperty("close", out var close) ? decimal.Parse(close.GetString() ?? "0") : 0;
                        var previousClose = quoteElement.TryGetProperty("previous_close", out var prevClose) ? decimal.Parse(prevClose.GetString() ?? "0") : price;
                        var change = quoteElement.TryGetProperty("change", out var changeProp) ? decimal.Parse(changeProp.GetString() ?? "0") : (price - previousClose);
                        var changePercent = quoteElement.TryGetProperty("percent_change", out var changePct) ? decimal.Parse(changePct.GetString() ?? "0") : (previousClose != 0 ? (change / previousClose) * 100 : 0);
                        var volume = quoteElement.TryGetProperty("volume", out var vol) ? long.Parse(vol.GetString() ?? "0") : 0;

                        quotes.Add(new StockQuote
                        {
                            Symbol = symbol,
                            Price = price,
                            Change = change,
                            ChangePercent = changePercent,
                            Volume = volume,
                            Timestamp = DateTime.UtcNow
                        });
                    }
                }
            }

            return quotes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting multiple stock quotes");
            throw;
        }
    }

    public async Task<List<StockHistoricalData>> GetHistoricalDataAsync(string symbol, string interval = "1day", int? outputSize = null)
    {
        try
        {
            // Default to 30 days if outputSize not specified
            if (!outputSize.HasValue)
            {
                outputSize = interval switch
                {
                    "1day" => 30,
                    "1week" => 12,
                    "1month" => 12,
                    _ => 30
                };
            }

            var url = $"{_apiUrl}/time_series?symbol={Uri.EscapeDataString(symbol)}&interval={interval}&outputsize={outputSize.Value}&apikey={_apiKey}";

            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            
            if (result.TryGetProperty("status", out var status) && status.GetString() == "error")
            {
                var errorMessage = result.TryGetProperty("message", out var msg) ? msg.GetString() : "Unknown error";
                _logger.LogWarning("Historical data API returned error for symbol: {Symbol}. Message: {Message}", symbol, errorMessage);
                return new List<StockHistoricalData>();
            }

            var historicalData = new List<StockHistoricalData>();

            if (result.TryGetProperty("values", out var values) && values.ValueKind == JsonValueKind.Array)
            {
                foreach (var value in values.EnumerateArray())
                {
                    if (DateTime.TryParse(value.TryGetProperty("datetime", out var dt) ? dt.GetString() : null, out var date))
                    {
                        historicalData.Add(new StockHistoricalData
                        {
                            Date = date,
                            Open = value.TryGetProperty("open", out var open) ? decimal.Parse(open.GetString() ?? "0") : 0,
                            High = value.TryGetProperty("high", out var high) ? decimal.Parse(high.GetString() ?? "0") : 0,
                            Low = value.TryGetProperty("low", out var low) ? decimal.Parse(low.GetString() ?? "0") : 0,
                            Close = value.TryGetProperty("close", out var close) ? decimal.Parse(close.GetString() ?? "0") : 0,
                            Volume = value.TryGetProperty("volume", out var vol) ? long.Parse(vol.GetString() ?? "0") : 0
                        });
                    }
                }
            }

            // Return data sorted by date (oldest first for chart)
            return historicalData.OrderBy(d => d.Date).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting historical data for symbol: {Symbol}", symbol);
            throw;
        }
    }
}

