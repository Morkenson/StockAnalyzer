using StockAnalyzer.Api.Services;
using StockAnalyzer.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS for Angular frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "https://localhost:4200")
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

// Register services
builder.Services.AddScoped<ISnapTradeService, SnapTradeService>();
builder.Services.AddScoped<IUserService, UserService>();

// Database context (if using Entity Framework)
// builder.Services.AddDbContext<ApplicationDbContext>(options =>
//     options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowAngular");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

