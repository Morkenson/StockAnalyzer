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
    └── StockAnalyzer.Api/
        ├── Controllers/          # API controllers
        ├── Services/            # Business logic services
        ├── Models/              # C# models
        └── Data/                # Database context (if using EF Core)
```

## Prerequisites

- Node.js (v18 or higher)
- .NET 8.0 SDK
- Angular CLI (v17)
- SQL Server (optional, for database storage)

## Setup Instructions

### Backend (.NET)

1. Navigate to the backend directory:
   ```bash
   cd backend/StockAnalyzer.Api
   ```

2. Restore packages:
   ```bash
   dotnet restore
   ```

3. Update `appsettings.json` with your SnapTrade credentials:
   ```json
   {
     "SnapTrade": {
       "ClientId": "YOUR_CLIENT_ID",
       "ClientSecret": "YOUR_CLIENT_SECRET",
       "ConsumerKey": "YOUR_CONSUMER_KEY",
       "ApiUrl": "https://api.snaptrade.com/api/v1"
     }
   }
   ```

4. Run the backend:
   ```bash
   dotnet run
   ```
   
   The API will be available at `https://localhost:5001` (or `http://localhost:5000`)

### Frontend (Angular)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Update `src/environments/environment.ts` with your backend URL:
   ```typescript
   api: {
     baseUrl: 'https://localhost:5001/api', // Match your backend URL
   }
   ```

4. Run the frontend:
   ```bash
   npm start
   ```
   
   The app will be available at `http://localhost:4200`

## Architecture

### Frontend → Backend → SnapTrade API

- **Angular Frontend**: Handles UI and user interactions
- **.NET Backend**: Manages API calls, authentication, and secure storage of user secrets
- **SnapTrade API**: Provides brokerage account integration

### Security Features

- User secrets stored securely on the backend (not exposed to frontend)
- API keys and credentials managed by backend only
- CORS configured for Angular frontend
- Authentication ready (JWT tokens can be added)

## Development Notes

### Current Implementation Status

- ✅ Backend API structure created
- ✅ Angular service updated to call backend
- ✅ Portfolio component updated
- ⚠️ User authentication placeholder (using header `X-User-Id`)
- ⚠️ User secrets stored in-memory (need database implementation)

### Next Steps

1. **Implement Authentication**: Add JWT authentication or Identity
2. **Database Storage**: Replace in-memory UserService with database storage
3. **Error Handling**: Enhance error handling and user feedback
4. **Testing**: Add unit and integration tests

## API Endpoints

### SnapTrade Controller (`/api/snaptrade`)

- `POST /api/snaptrade/user` - Create/get SnapTrade user
- `POST /api/snaptrade/connect/initiate` - Initiate brokerage connection
- `GET /api/snaptrade/portfolio` - Get user portfolio
- `GET /api/snaptrade/accounts` - Get user accounts
- `GET /api/snaptrade/accounts/{accountId}/holdings` - Get account holdings
- `GET /api/snaptrade/brokerages` - Get available brokerages
- `GET /api/snaptrade/callback` - OAuth callback handler

## License

MIT
