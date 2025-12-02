using StockAnalyzer.Services;
using DotNetEnv;

// Load .env file from project root (one level up from backend)
var envPath = Path.Combine(Directory.GetCurrentDirectory(), "..", ".env");
if (File.Exists(envPath))
{
    Env.Load(envPath);
}
else
{
    // Also try loading from current directory
    Env.Load();
}

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddApplicationPart(typeof(Program).Assembly) // Ensure all controllers are discovered
    .AddJsonOptions(options =>
    {
        // Configure JSON serialization to use camelCase for property names
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS for Angular frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins(
                "http://localhost:4200", 
                "https://localhost:4200"
            )
            .SetIsOriginAllowed(origin => 
                origin != null && (
                    origin.Contains("localhost") || 
                    origin.Contains("vercel.app") ||
                    origin.Contains("127.0.0.1")
                )
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Register HttpClient for SnapTrade API calls
builder.Services.AddHttpClient<ISnapTradeService, SnapTradeService>(client =>
{
    var apiUrl = builder.Configuration["SnapTrade:ApiUrl"] ?? "https://api.snaptrade.com/api/v1";
    client.BaseAddress = new Uri(apiUrl);
    client.DefaultRequestHeaders.Add("X-API-Key", builder.Configuration["SnapTrade:ClientId"] ?? "");
    client.DefaultRequestHeaders.Add("X-Consumer-Key", builder.Configuration["SnapTrade:ConsumerKey"] ?? "");
});

// Register HttpClient for Twelve Data API calls
// AddHttpClient automatically registers the service, so no need for duplicate registration
builder.Services.AddHttpClient<IStockDataService, StockDataService>();

// Register other services
builder.Services.AddScoped<IUserService, UserService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Only use HTTPS redirection in production
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("AllowAngular");

app.MapControllers();

app.Run();

