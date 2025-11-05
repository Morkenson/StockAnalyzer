# Stock Analyzer

A comprehensive stock analysis application built with Angular, similar to Quandl or other stock analysis platforms. This template provides a solid foundation for building a stock market analysis tool with search, watchlist, charts, and detailed stock metrics.

## Features

- 🔍 **Stock Search**: Search for stocks by symbol or company name with real-time search results
- 📊 **Stock Details**: View comprehensive stock information including:
  - Real-time price and price changes
  - Key metrics (Market Cap, P/E Ratio, Dividend Yield, etc.)
  - Financial metrics (EPS, Beta, Revenue, Profit Margin, etc.)
  - Interactive price charts with historical data
- ⭐ **Watchlist**: Add stocks to your personal watchlist (stored in localStorage)
- 📈 **Dashboard**: View popular stocks and your watchlist at a glance
- 📱 **Responsive Design**: Modern, mobile-friendly UI

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── dashboard/          # Main dashboard page
│   │   ├── stock-search/       # Stock search functionality
│   │   ├── stock-details/      # Individual stock detail page
│   │   ├── watchlist/          # User watchlist page
│   │   └── shared/             # Reusable components
│   │       ├── header/         # Navigation header
│   │       ├── stock-card/     # Stock card component
│   │       └── stock-chart/    # Chart component
│   ├── models/
│   │   └── stock.model.ts      # TypeScript interfaces for stock data
│   ├── services/
│   │   ├── stock.service.ts    # API service for stock data
│   │   └── watchlist.service.ts # Watchlist management service
│   ├── app.module.ts           # Root Angular module
│   ├── app-routing.module.ts   # Application routing
│   └── app.component.ts        # Root component
├── styles.scss                 # Global styles
├── index.html                  # HTML entry point
└── main.ts                     # Application bootstrap
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Angular CLI (v17 or higher)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Service:**
   - Open `src/app/services/stock.service.ts`
   - Replace `apiUrl` with your actual stock API endpoint
   - Add your API key to the `apiKey` property
   
   Popular stock API options:
   - **Alpha Vantage**: https://www.alphavantage.co/
   - **Yahoo Finance API**: Various free options available
   - **Polygon.io**: https://polygon.io/
   - **Finnhub**: https://finnhub.io/
   - **IEX Cloud**: https://iexcloud.io/

3. **Update API Methods:**
   The service currently includes mock data methods for development. Replace the mock implementations in `stock.service.ts` with actual API calls based on your chosen provider.

   Key methods to implement:
   - `searchStocks()` - Search for stocks
   - `getStockDetails()` - Get detailed stock information
   - `getStockQuote()` - Get real-time stock quotes
   - `getHistoricalData()` - Get historical price data
   - `getStockMetrics()` - Get financial metrics
   - `getMultipleQuotes()` - Batch quote requests

### Running the Application

```bash
# Development server
npm start
# or
ng serve

# Navigate to http://localhost:4200
```

### Building for Production

```bash
npm run build
# or
ng build --configuration production
```

## API Integration Guide

### Example: Alpha Vantage Integration

```typescript
// In stock.service.ts
searchStocks(query: string): Observable<StockSearchResult[]> {
  const params = new HttpParams()
    .set('function', 'SYMBOL_SEARCH')
    .set('keywords', query)
    .set('apikey', this.apiKey);

  return this.http.get<any>(`${this.apiUrl}/query`, { params })
    .pipe(
      map(response => response.bestMatches.map((match: any) => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
        exchange: match['4. region'],
        type: match['3. type']
      }))),
      catchError(error => {
        console.error('Error searching stocks:', error);
        return of([]);
      })
    );
}
```

### Example: Finnhub Integration

```typescript
getStockQuote(symbol: string): Observable<StockQuote> {
  return this.http.get<any>(`${this.apiUrl}/quote?symbol=${symbol}&token=${this.apiKey}`)
    .pipe(
      map(response => ({
        symbol: symbol,
        price: response.c,
        change: response.d,
        changePercent: response.dp,
        volume: response.v,
        timestamp: new Date(response.t * 1000)
      })),
      catchError(error => {
        console.error('Error fetching quote:', error);
        return of(this.getMockQuote(symbol));
      })
    );
}
```

## Customization

### Adding New Features

1. **New Components**: Create components in `src/app/components/`
2. **New Services**: Add services in `src/app/services/`
3. **New Routes**: Add routes in `src/app/app-routing.module.ts`
4. **Styling**: Modify `src/styles.scss` or component-specific styles

### Styling

The application uses SCSS with a modern, responsive design. Key styling is in:
- `src/styles.scss` - Global styles
- Component-specific styles in each component's `styles` array

### Data Models

Stock data models are defined in `src/app/models/stock.model.ts`. Extend these interfaces to match your API's response structure.

## Features to Implement

- [ ] Real-time price updates (WebSocket integration)
- [ ] News feed for stocks
- [ ] Technical indicators (RSI, MACD, etc.)
- [ ] Portfolio tracking
- [ ] Alerts and notifications
- [ ] Export data to CSV/Excel
- [ ] Comparison charts (multiple stocks)
- [ ] Market indices overview
- [ ] User authentication
- [ ] Backend integration for persistent watchlists

## Dependencies

- **Angular 17**: Frontend framework
- **RxJS**: Reactive programming
- **Chart.js / ng2-charts**: Charting library
- **date-fns**: Date manipulation utilities

## Development Notes

- The application uses mock data by default. Replace mock implementations with actual API calls.
- Watchlist is stored in browser localStorage (no backend required).
- All API calls include error handling with fallback to mock data.
- Components are structured for easy testing and maintenance.

## License

This project is a template for building stock analysis applications. Customize and extend as needed for your requirements.

## Contributing

This is a template project. Feel free to fork and customize for your needs!

