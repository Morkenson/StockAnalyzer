# SnapTrade Integration Setup Guide

## Overview

The SnapTrade service (`src/app/services/snaptrade.service.ts`) provides integration with the SnapTrade API for connecting brokerage accounts, viewing portfolios, and executing trades.

## Configuration

### 1. Set Up API Credentials

Edit `src/environments/environment.ts`:

```typescript
snapTrade: {
  apiUrl: 'https://api.snaptrade.com/api/v1',
  clientId: 'YOUR_SNAPTRADE_CLIENT_ID',
  clientSecret: 'YOUR_SNAPTRADE_CLIENT_SECRET',
  consumerKey: 'YOUR_SNAPTRADE_CONSUMER_KEY' // Optional
}
```

**Get your credentials from:** [SnapTrade Dashboard](https://snaptrade.com)

### 2. Security Notes

- **Never commit API keys to version control**
- Use environment variables for production
- Consider using a backend proxy for sensitive operations
- Store secrets securely (use CI/CD secrets management)

## Available Methods

### User Management
- `createUser(userId: string, email?: string)` - Create a new SnapTrade user
- `getUser(userId: string)` - Get user information

### Brokerage Management
- `getBrokerages()` - Get list of available brokerages
- `initiateConnection(userId: string, brokerageId: string)` - Start OAuth connection flow
- `completeConnection(userId: string, connectionId: string)` - Complete OAuth callback
- `getConnections(userId: string)` - Get all user's brokerage connections
- `deleteConnection(userId: string, connectionId: string)` - Disconnect a brokerage

### Account Operations
- `getAccounts(userId: string)` - Get all accounts for a user
- `getAccount(userId: string, accountId: string)` - Get account details
- `getAccountBalance(userId: string, accountId: string)` - Get account balance
- `syncAccount(userId: string, accountId: string)` - Refresh account data

### Portfolio & Holdings
- `getPortfolio(userId: string)` - Get complete portfolio overview
- `getAccountHoldings(userId: string, accountId: string)` - Get holdings for an account

### Trading
- `placeTrade(userId: string, accountId: string, order: TradeOrder)` - Place a trade order
- `getTradeStatus(userId: string, accountId: string, tradeId: string)` - Check trade status
- `cancelTrade(userId: string, accountId: string, tradeId: string)` - Cancel a pending trade
- `getTradeHistory(userId: string, accountId: string)` - Get trade history

### Other
- `getQuote(symbol: string)` - Get current quote for a symbol

## Usage Examples

### Connecting a Brokerage Account

```typescript
import { Component } from '@angular/core';
import { SnapTradeService } from './services/snaptrade.service';

@Component({...})
export class BrokerageConnectionComponent {
  constructor(private snapTradeService: SnapTradeService) {}

  async connectBrokerage(userId: string, brokerageId: string) {
    try {
      const response = await this.snapTradeService
        .initiateConnection(userId, brokerageId)
        .toPromise();
      
      // Redirect user to OAuth URL
      window.location.href = response.redirectUri;
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }
}
```

### Viewing Portfolio

```typescript
import { Component, OnInit } from '@angular/core';
import { SnapTradeService } from './services/snaptrade.service';
import { Portfolio } from './models/snaptrade.model';

@Component({...})
export class PortfolioComponent implements OnInit {
  portfolio: Portfolio | null = null;

  constructor(private snapTradeService: SnapTradeService) {}

  ngOnInit() {
    this.loadPortfolio('user123');
  }

  loadPortfolio(userId: string) {
    this.snapTradeService.getPortfolio(userId).subscribe({
      next: (portfolio) => {
        this.portfolio = portfolio;
      },
      error: (error) => {
        console.error('Error loading portfolio:', error);
      }
    });
  }
}
```

### Placing a Trade

```typescript
import { TradeOrder } from './models/snaptrade.model';

placeTrade() {
  const order: TradeOrder = {
    symbol: 'AAPL',
    action: 'BUY',
    quantity: 10,
    orderType: 'MARKET',
    timeInForce: 'DAY',
    accountId: 'account123'
  };

  this.snapTradeService
    .placeTrade('user123', 'account123', order)
    .subscribe({
      next: (execution) => {
        console.log('Trade placed:', execution);
      },
      error: (error) => {
        console.error('Trade failed:', error);
      }
    });
}
```

## Data Models

All SnapTrade data models are defined in `src/app/models/snaptrade.model.ts`:

- `SnapTradeUser` - User information
- `Brokerage` - Brokerage provider details
- `BrokerageConnection` - Connected brokerage account
- `Account` - Trading account
- `Holding` - Stock position
- `Portfolio` - Complete portfolio view
- `TradeOrder` - Trade order request
- `TradeExecution` - Trade execution result
- `AccountBalance` - Account balance information

## Error Handling

All service methods use RxJS `catchError` and `throwError` for error handling. Always handle errors in your components:

```typescript
this.snapTradeService.getAccounts(userId).subscribe({
  next: (accounts) => {
    // Handle success
  },
  error: (error) => {
    // Handle error - show user-friendly message
    this.errorMessage = 'Failed to load accounts. Please try again.';
  }
});
```

## OAuth Flow

SnapTrade uses OAuth for brokerage connections:

1. Call `initiateConnection()` to get redirect URL
2. Redirect user to the OAuth URL
3. User authenticates with their brokerage
4. Brokerage redirects back to your callback URL
5. Call `completeConnection()` with the connection ID
6. Account is now connected and ready to use

## Next Steps

1. Create components for:
   - Brokerage connection UI
   - Portfolio display
   - Trading interface
   - Account management

2. Add routing for SnapTrade pages
3. Implement proper authentication/user management
4. Add error handling and user feedback
5. Test with SnapTrade sandbox environment

## Resources

- [SnapTrade API Documentation](https://docs.snaptrade.com)
- [SnapTrade Developer Portal](https://snaptrade.com/developers)
- [SnapTrade TypeScript SDK](https://www.npmjs.com/package/snaptrade-typescript-sdk) (Alternative to HTTP approach)

