# StockAnalyzer

A comprehensive stock analysis tool built with Angular frontend and .NET backend, integrated with SnapTrade for brokerage account management.

## Project Structure

```
StockAnalyzer/
├── frontend/                     # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/      # Angular components
│   │   │   ├── services/        # Angular services
│   │   │   └── models/          # TypeScript models
│   │   └── environments/        # Environment configuration
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
└── backend/                      # .NET backend
    ├── Controllers/              # API controllers
    ├── Services/                # Business logic services
    ├── Models/                  # C# models
    ├── Properties/              # Application properties
    ├── Program.cs               # Application entry point
    └── StockAnalyzer.csproj     # Project file
```