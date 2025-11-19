import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StockService } from '../../../services/stock.service';
import { WatchlistService } from '../../../services/watchlist.service';
import { Stock, StockHistoricalData, StockMetrics } from '../../../models/stock.model';

@Component({
  selector: 'app-stock-details',
  template: `
    <div class="stock-details" *ngIf="stock">
      <div class="card">
        <div class="stock-header">
          <div class="stock-info">
            <h1>{{ stock.symbol }}</h1>
            <p class="stock-name">{{ stock.name }}</p>
            <span class="stock-exchange">{{ stock.exchange }}</span>
          </div>
          <div class="stock-price-section">
            <div class="stock-price" [class.positive]="stock.change && stock.change >= 0" 
                 [class.negative]="stock.change && stock.change < 0">
              {{ '$' + (stock.currentPrice | number:'1.2-2') }}
            </div>
            <div *ngIf="stock.change !== undefined && stock.changePercent !== undefined" class="stock-change" 
                 [class.positive]="stock.change >= 0" 
                 [class.negative]="stock.change < 0">
              <span class="change-arrow">{{ stock.change >= 0 ? '↑' : '↓' }}</span>
              <span>{{ stock.change >= 0 ? '+' : '' }}{{ stock.change | number:'1.2-2' }}</span>
              <span>({{ stock.changePercent >= 0 ? '+' : '' }}{{ stock.changePercent | number:'1.2-2' }}%)</span>
            </div>
          </div>
        </div>

        <div class="stock-actions">
          <button 
            *ngIf="!isInWatchlist"
            class="btn btn-primary" 
            (click)="addToWatchlist()">
            Add to Watchlist
          </button>
          <button 
            *ngIf="isInWatchlist"
            class="btn btn-secondary" 
            (click)="removeFromWatchlist()">
            Remove from Watchlist
          </button>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">Key Metrics</div>
          <table class="metrics-table">
            <tr *ngIf="stock.marketCap">
              <td>Market Cap</td>
              <td>{{ stock.marketCap | number }}</td>
            </tr>
            <tr *ngIf="stock.peRatio">
              <td>P/E Ratio</td>
              <td>{{ stock.peRatio | number:'1.2-2' }}</td>
            </tr>
            <tr *ngIf="stock.dividendYield">
              <td>Dividend Yield</td>
              <td>{{ stock.dividendYield | number:'1.2-2' }}%</td>
            </tr>
            <tr *ngIf="stock.volume">
              <td>Volume</td>
              <td>{{ stock.volume | number }}</td>
            </tr>
            <tr *ngIf="stock.high52Week">
              <td>52 Week High</td>
              <td>{{ '$' + (stock.high52Week | number:'1.2-2') }}</td>
            </tr>
            <tr *ngIf="stock.low52Week">
              <td>52 Week Low</td>
              <td>{{ '$' + (stock.low52Week | number:'1.2-2') }}</td>
            </tr>
          </table>
        </div>

        <div class="card" *ngIf="metrics">
          <div class="card-header">Financial Metrics</div>
          <table class="metrics-table">
            <tr *ngIf="metrics.eps">
              <td>EPS</td>
              <td>{{ '$' + (metrics.eps | number:'1.2-2') }}</td>
            </tr>
            <tr *ngIf="metrics.beta">
              <td>Beta</td>
              <td>{{ metrics.beta | number:'1.2-2' }}</td>
            </tr>
            <tr *ngIf="metrics.revenue">
              <td>Revenue</td>
              <td>{{ '$' + (metrics.revenue | number) }}</td>
            </tr>
            <tr *ngIf="metrics.profitMargin">
              <td>Profit Margin</td>
              <td>{{ metrics.profitMargin | number:'1.2-2' }}%</td>
            </tr>
            <tr *ngIf="metrics.roe">
              <td>ROE</td>
              <td>{{ metrics.roe | number:'1.2-2' }}%</td>
            </tr>
            <tr *ngIf="metrics.debtToEquity">
              <td>Debt to Equity</td>
              <td>{{ metrics.debtToEquity | number:'1.2-2' }}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Price Chart</div>
        <app-stock-chart [historicalData]="historicalData"></app-stock-chart>
      </div>

      <div class="card" *ngIf="stock.description">
        <div class="card-header">About</div>
        <p>{{ stock.description }}</p>
      </div>
    </div>

    <div *ngIf="loading" class="card">
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading stock data...</p>
      </div>
    </div>

    <div *ngIf="error" class="card">
      <div class="error-message">
        <h3>Error Loading Stock</h3>
        <p>{{ error }}</p>
        <button class="btn btn-primary" (click)="loadStockData()">Retry</button>
      </div>
    </div>
  `,
  styles: [`
    .stock-details {
      padding: var(--spacing-xl) 0;
    }

    .stock-details h1 {
      margin-bottom: var(--spacing-sm);
      color: var(--color-text-primary);
    }

    .stock-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-xl);
      gap: var(--spacing-lg);
      flex-wrap: wrap;
    }

    .stock-info {
      flex: 1;
    }

    .stock-name {
      font-size: var(--font-size-lg);
      color: var(--color-text-secondary);
      margin: var(--spacing-xs) 0;
      font-weight: var(--font-weight-medium);
    }

    .stock-exchange {
      font-size: var(--font-size-sm);
      color: var(--color-text-tertiary);
      margin: 0;
      display: inline-block;
      padding: var(--spacing-xs) var(--spacing-sm);
      background-color: var(--color-bg-tertiary);
      border-radius: var(--radius-sm);
    }

    .stock-price-section {
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
      align-items: flex-end;
    }

    .stock-change {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
    }

    .change-arrow {
      font-size: var(--font-size-lg);
    }

    .stock-actions {
      margin-top: var(--spacing-lg);
      display: flex;
      gap: var(--spacing-md);
    }

    .metrics-table {
      width: 100%;
    }

    .metrics-table tr {
      transition: background-color var(--transition-fast);
    }

    .metrics-table tr:hover {
      background-color: var(--color-bg-tertiary);
    }

    .metrics-table td {
      padding: var(--spacing-md) 0;
      border-bottom: 1px solid var(--color-border-light);
    }

    .metrics-table tr:last-child td {
      border-bottom: none;
    }

    .metrics-table td:first-child {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .metrics-table td:last-child {
      text-align: right;
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }

    @media (max-width: 768px) {
      .stock-details {
        padding: var(--spacing-lg) 0;
      }

      .stock-header {
        flex-direction: column;
        margin-bottom: var(--spacing-lg);
      }

      .stock-price-section {
        text-align: left;
        width: 100%;
      }

      .stock-actions {
        flex-direction: column;
      }

      .stock-actions .btn {
        width: 100%;
      }
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-2xl) 0;
    }

    .loading-state p {
      color: var(--color-text-secondary);
      margin: 0;
    }
  `]
})
export class StockDetailsComponent implements OnInit {
  stock: Stock | null = null;
  metrics: StockMetrics | null = null;
  historicalData: StockHistoricalData[] = [];
  loading = true;
  error: string | null = null;
  isInWatchlist = false;
  symbol: string = '';

  constructor(
    private route: ActivatedRoute,
    private stockService: StockService,
    private watchlistService: WatchlistService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.symbol = params['symbol'];
      this.loadStockData();
      this.checkWatchlistStatus();
    });
  }

  loadStockData(): void {
    this.loading = true;
    this.error = null;

    // Load stock details
    this.stockService.getStockDetails(this.symbol).subscribe({
      next: (stock) => {
        this.stock = stock;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load stock data. Please try again.';
        this.loading = false;
        console.error(err);
      }
    });

    // Load metrics
    this.stockService.getStockMetrics(this.symbol).subscribe({
      next: (metrics) => {
        this.metrics = metrics;
      },
      error: (err) => {
        console.error('Failed to load metrics:', err);
      }
    });

    // Load historical data (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    this.stockService.getHistoricalData(this.symbol, startDate, endDate).subscribe({
      next: (data) => {
        this.historicalData = data;
      },
      error: (err) => {
        console.error('Failed to load historical data:', err);
      }
    });
  }

  private checkWatchlistStatus(): void {
    this.watchlistService.getWatchlist().subscribe(watchlist => {
      this.isInWatchlist = watchlist.some(item => item.symbol === this.symbol);
    });
  }

  addToWatchlist(): void {
    this.watchlistService.addToWatchlist(this.symbol);
    this.isInWatchlist = true;
  }

  removeFromWatchlist(): void {
    this.watchlistService.removeFromWatchlist(this.symbol);
    this.isInWatchlist = false;
  }
}

