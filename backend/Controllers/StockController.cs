using Microsoft.AspNetCore.Mvc;
using StockAnalyzer.Models;
using StockAnalyzer.Services;

namespace StockAnalyzer.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StockController : ControllerBase
{
    private readonly IStockDataService _stockDataService;
    private readonly ILogger<StockController> _logger;

    public StockController(
        IStockDataService stockDataService,
        ILogger<StockController> logger)
    {
        _stockDataService = stockDataService;
        _logger = logger;
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchStocks([FromQuery(Name = "query")] string? query)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = "Query parameter is required"
                });
            }

            var results = await _stockDataService.SearchStocksAsync(query);
            return Ok(new ApiResponse<List<StockSearchResult>>
            {
                Success = true,
                Data = results
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching stocks");
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpGet("quote/{symbol}")]
    public async Task<IActionResult> GetStockQuote(string symbol)
    {
        try
        {
            var quote = await _stockDataService.GetStockQuoteAsync(symbol);
            if (quote == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Stock quote not found for symbol: {symbol}"
                });
            }

            return Ok(new ApiResponse<StockQuote>
            {
                Success = true,
                Data = quote
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting stock quote for symbol: {Symbol}", symbol);
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpGet("details/{symbol}")]
    public async Task<IActionResult> GetStockDetails(string symbol)
    {
        try
        {
            var details = await _stockDataService.GetStockDetailsAsync(symbol);
            if (details == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Stock details not found for symbol: {symbol}"
                });
            }

            return Ok(new ApiResponse<StockDetails>
            {
                Success = true,
                Data = details
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting stock details for symbol: {Symbol}", symbol);
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpPost("quotes")]
    public async Task<IActionResult> GetMultipleStockQuotes([FromBody] List<string> symbols)
    {
        try
        {
            if (symbols == null || symbols.Count == 0)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = "Symbols list is required"
                });
            }

            var quotes = await _stockDataService.GetMultipleStockQuotesAsync(symbols);
            return Ok(new ApiResponse<List<StockQuote>>
            {
                Success = true,
                Data = quotes
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting multiple stock quotes");
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpGet("historical/{symbol}")]
    public async Task<IActionResult> GetHistoricalData(
        string symbol,
        [FromQuery] string interval = "1day",
        [FromQuery] int? outputSize = null)
    {
        try
        {
            var data = await _stockDataService.GetHistoricalDataAsync(symbol, interval, outputSize);
            if (data == null || data.Count == 0)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Historical data not found for symbol: {symbol}"
                });
            }

            return Ok(new ApiResponse<List<StockHistoricalData>>
            {
                Success = true,
                Data = data
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting historical data for symbol: {Symbol}", symbol);
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }
}

