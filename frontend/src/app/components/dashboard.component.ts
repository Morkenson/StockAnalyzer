import { Component, OnInit } from '@angular/core';
import { StockService } from '../services/stock.service';
import { WatchlistService } from '../services/watchlist.service';
import { StockQuote } from '../models/stock.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="dashboard">
      <div class="dashboard-header">
        <h1>Dashboard</h1>
        <p class="dashboard-subtitle">Track your favorite stocks and monitor market trends</p>
      </div>
      
      <div class="card" *ngIf="marketIndexes$ | async as indexes">
        <div class="card-header">
          <span>Market Indexes</span>
          <span class="card-badge">{{ indexes.length }}</span>
        </div>
        <div class="grid grid-3" *ngIf="indexes.length > 0">
          <app-stock-card 
            *ngFor="let index of indexes" 
            [stock]="index"
            [showAddToWatchlist]="true">
          </app-stock-card>
        </div>
        <div *ngIf="indexes.length === 0" class="empty-state">
          <p>Market indexes data is loading...</p>
        </div>
      </div>

      <div class="card" *ngIf="watchlistQuotes$ | async as quotes">
        <div class="card-header">
          <span>Your Watchlist</span>
          <span class="card-badge" *ngIf="quotes.length > 0">{{ quotes.length }}</span>
        </div>
        <div *ngIf="quotes.length === 0" class="empty-state">
          <div class="empty-state-icon">📊</div>
          <h3>Your watchlist is empty</h3>
          <p>Start tracking stocks by adding them from the search page</p>
          <button class="btn btn-primary" routerLink="/search">Search Stocks</button>
        </div>
        <div class="grid grid-3" *ngIf="quotes.length > 0">
          <app-stock-card 
            *ngFor="let quote of quotes" 
            [stock]="quote"
            [showAddToWatchlist]="false">
          </app-stock-card>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Market Overview</div>
        <div class="market-overview-placeholder">
          <p class="placeholder-text">Market overview widgets coming soon</p>
          <p class="placeholder-subtext">Indices, trending stocks, and market insights will appear here</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      padding: var(--spacing-xl) 0;
    }

    .dashboard-header {
      margin-bottom: var(--spacing-2xl);
    }

    .dashboard-header h1 {
      margin-bottom: var(--spacing-sm);
    }

    .dashboard-subtitle {
      font-size: var(--font-size-lg);
      color: var(--color-text-secondary);
      margin-bottom: 0;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-md);
    }

    .card-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 var(--spacing-sm);
      background-color: var(--color-primary);
      color: white;
      border-radius: var(--radius-full);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
    }

    .empty-state {
      text-align: center;
      padding: var(--spacing-3xl) var(--spacing-xl);
      color: var(--color-text-secondary);
    }

    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: var(--spacing-md);
      opacity: 0.5;
    }

    .empty-state h3 {
      margin-bottom: var(--spacing-sm);
      color: var(--color-text-primary);
    }

    .empty-state p {
      margin-bottom: var(--spacing-lg);
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }

    .market-overview-placeholder {
      padding: var(--spacing-2xl);
      text-align: center;
    }

    .placeholder-text {
      font-size: var(--font-size-lg);
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-sm);
    }

    .placeholder-subtext {
      font-size: var(--font-size-sm);
      color: var(--color-text-tertiary);
      margin-bottom: 0;
    }

    @media (max-width: 768px) {
      .dashboard {
        padding: var(--spacing-lg) 0;
      }

      .dashboard-header {
        margin-bottom: var(--spacing-xl);
      }

      .dashboard-subtitle {
        font-size: var(--font-size-base);
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  marketIndexes$!: Observable<StockQuote[]>;
  watchlistQuotes$!: Observable<StockQuote[]>;

  // Market indexes to display: S&P 500 (SPY), QQQ (Nasdaq 100), Bitcoin (BTC/USD)
  private marketIndexSymbols = ['SPY', 'QQQ', 'BTC/USD'];

  constructor(
    private stockService: StockService,
    private watchlistService: WatchlistService
  ) {}

  ngOnInit(): void {
    // Load market indexes
    this.loadMarketIndexes();
    
    // Load watchlist stocks
    this.loadWatchlistStocks();
  }

  private loadMarketIndexes(): void {
    this.marketIndexes$ = this.stockService.getMultipleQuotes(this.marketIndexSymbols);
  }

  private loadWatchlistStocks(): void {
    this.watchlistService.getWatchlist().subscribe(watchlist => {
      const symbols = watchlist.map(item => item.symbol);
      if (symbols.length > 0) {
        this.watchlistQuotes$ = this.stockService.getMultipleQuotes(symbols);
      } else {
        this.watchlistQuotes$ = new Observable(observer => {
          observer.next([]);
          observer.complete();
        });
      }
    });
  }
}

