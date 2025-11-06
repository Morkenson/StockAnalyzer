using Microsoft.AspNetCore.Mvc;
using StockAnalyzer.Api.Models;
using StockAnalyzer.Api.Services;

namespace StockAnalyzer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SnapTradeController : ControllerBase
{
    private readonly ISnapTradeService _snapTradeService;
    private readonly IUserService _userService;
    private readonly ILogger<SnapTradeController> _logger;

    public SnapTradeController(
        ISnapTradeService snapTradeService,
        IUserService userService,
        ILogger<SnapTradeController> logger)
    {
        _snapTradeService = snapTradeService;
        _userService = userService;
        _logger = logger;
    }

    // TODO: Replace with actual authentication
    // For now, using a simple header or query parameter
    private string GetUserId()
    {
        // TODO: Get from JWT token or session
        // For now, using a default user ID
        return Request.Headers["X-User-Id"].FirstOrDefault() ?? "user123";
    }

    [HttpPost("user")]
    public async Task<IActionResult> CreateUser()
    {
        try
        {
            var userId = GetUserId();
            var user = await _snapTradeService.CreateUserAsync(userId);
            
            // Store userSecret (in real implementation, get from response)
            // For now, we'll need to get it from the SnapTrade API response
            // This is a simplified version - you may need to adjust based on actual API response
            
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "User created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating SnapTrade user");
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpPost("connect/initiate")]
    public async Task<IActionResult> InitiateConnection()
    {
        try
        {
            var userId = GetUserId();
            var userSecret = await _userService.GetUserSecretAsync(userId);

            if (string.IsNullOrEmpty(userSecret))
            {
                // User doesn't exist, create one first
                var user = await _snapTradeService.CreateUserAsync(userId);
                // Note: In real implementation, you'd get userSecret from the response
                // For now, this is a placeholder
                userSecret = "temp_secret"; // TODO: Get from actual API response
                await _userService.StoreUserSecretAsync(userId, userSecret);
            }

            var redirectUri = $"{Request.Scheme}://{Request.Host}/api/snaptrade/callback";
            var loginLink = await _snapTradeService.InitiateConnectionAsync(userId, userSecret, redirectUri);

            if (string.IsNullOrEmpty(loginLink))
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = "Failed to get redirect URL from SnapTrade"
                });
            }

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Data = new { redirectUri = loginLink }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating connection");
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpGet("portfolio")]
    public async Task<IActionResult> GetPortfolio()
    {
        try
        {
            var userId = GetUserId();
            var userSecret = await _userService.GetUserSecretAsync(userId);

            if (string.IsNullOrEmpty(userSecret))
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = "User not found. Please connect your account first."
                });
            }

            var portfolio = await _snapTradeService.GetPortfolioAsync(userId, userSecret);
            return Ok(new ApiResponse<Portfolio>
            {
                Success = true,
                Data = portfolio
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching portfolio");
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts()
    {
        try
        {
            var userId = GetUserId();
            var userSecret = await _userService.GetUserSecretAsync(userId);

            if (string.IsNullOrEmpty(userSecret))
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = "User not found. Please connect your account first."
                });
            }

            var accounts = await _snapTradeService.GetAccountsAsync(userId, userSecret);
            return Ok(new ApiResponse<List<Account>>
            {
                Success = true,
                Data = accounts
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching accounts");
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpGet("accounts/{accountId}/holdings")]
    public async Task<IActionResult> GetAccountHoldings(string accountId)
    {
        try
        {
            var userId = GetUserId();
            var userSecret = await _userService.GetUserSecretAsync(userId);

            if (string.IsNullOrEmpty(userSecret))
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = "User not found. Please connect your account first."
                });
            }

            var holdings = await _snapTradeService.GetAccountHoldingsAsync(userId, userSecret, accountId);
            return Ok(new ApiResponse<List<Holding>>
            {
                Success = true,
                Data = holdings
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching holdings");
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpGet("brokerages")]
    public async Task<IActionResult> GetBrokerages()
    {
        try
        {
            var brokerages = await _snapTradeService.GetBrokeragesAsync();
            return Ok(new ApiResponse<List<Brokerage>>
            {
                Success = true,
                Data = brokerages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching brokerages");
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpGet("callback")]
    public IActionResult OAuthCallback([FromQuery] string? code, [FromQuery] string? state)
    {
        // Handle OAuth callback from SnapTrade
        // Redirect back to Angular app
        var angularUrl = "http://localhost:4200/portfolio";
        return Redirect(angularUrl);
    }
}

