import { Component, OnInit } from '@angular/core';
import { StockService } from '../services/stock.service';
import { WatchlistService } from '../services/watchlist.service';
import { WatchlistItem, StockQuote } from '../models/stock.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-watchlist',
  template: `
    <div class="watchlist">
      <div class="watchlist-header">
        <div>
          <h1>My Watchlist</h1>
          <p class="watchlist-subtitle" *ngIf="watchlistItems.length > 0">
            Tracking {{ watchlistItems.length }} {{ watchlistItems.length === 1 ? 'stock' : 'stocks' }}
          </p>
        </div>
        <button 
          *ngIf="watchlistItems.length > 0" 
          class="btn btn-primary"
          routerLink="/search">
          + Add Stocks
        </button>
      </div>
      
      <div class="card" *ngIf="watchlistItems.length === 0">
        <div class="empty-state">
          <div class="empty-state-icon">⭐</div>
          <h3>Your watchlist is empty</h3>
          <p>Search for stocks and add them to your watchlist to track them here</p>
          <button class="btn btn-primary" routerLink="/search">Search Stocks</button>
        </div>
      </div>

      <div *ngIf="watchlistItems.length > 0" class="card watchlist-card">
        <div class="card-header">
          <span>Watchlist</span>
          <span class="card-badge">{{ watchlistItems.length }}</span>
        </div>
        
        <div *ngIf="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading watchlist data...</p>
        </div>
        
        <div *ngIf="!loading && stockQuotes.length > 0" class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Price</th>
                <th>Change</th>
                <th>Change %</th>
                <th>Volume</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let quote of stockQuotes; let i = index" class="watchlist-row">
                <td>
                  <button 
                    class="symbol-link"
                    (click)="viewStock(quote.symbol)"
                    [attr.aria-label]="'View details for ' + quote.symbol">
                    <strong>{{ quote.symbol }}</strong>
                  </button>
                </td>
                <td class="price-cell">
                  <span class="price-value">{{ '$' + (quote.price | number:'1.2-2') }}</span>
                </td>
                <td>
                  <span class="change-value" [class.positive]="quote.change >= 0" [class.negative]="quote.change < 0">
                    {{ quote.change >= 0 ? '+' : '' }}{{ quote.change | number:'1.2-2' }}
                  </span>
                </td>
                <td>
                  <span class="change-percent" [class.positive]="quote.changePercent >= 0" [class.negative]="quote.changePercent < 0">
                    {{ quote.changePercent >= 0 ? '+' : '' }}{{ quote.changePercent | number:'1.2-2' }}%
                  </span>
                </td>
                <td class="volume-cell">{{ quote.volume | number }}</td>
                <td class="date-cell">{{ getAddedDate(quote.symbol) | date:'MMM d, y' }}</td>
                <td class="actions-cell">
                  <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" (click)="viewStock(quote.symbol)">View</button>
                    <button 
                      class="btn btn-secondary btn-sm" 
                      (click)="removeFromWatchlist(quote.symbol)"
                      [attr.aria-label]="'Remove ' + quote.symbol + ' from watchlist'">
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="!loading && stockQuotes.length === 0 && watchlistItems.length > 0" class="empty-state">
          <p>Unable to load stock data. Please try refreshing.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .watchlist {
      padding: var(--spacing-xl) 0;
    }

    .watchlist-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-2xl);
      gap: var(--spacing-lg);
    }

    .watchlist-header h1 {
      margin-bottom: var(--spacing-sm);
    }

    .watchlist-subtitle {
      font-size: var(--font-size-lg);
      color: var(--color-text-secondary);
      margin-bottom: 0;
    }

    .watchlist-card {
      margin-bottom: var(--spacing-lg);
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

    .table-wrapper {
      overflow-x: auto;
      margin-top: var(--spacing-md);
    }

    .watchlist-row {
      transition: background-color var(--transition-fast);
    }

    .watchlist-row:hover {
      background-color: var(--color-bg-tertiary);
    }

    .symbol-link {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
    }

    .symbol-link strong {
      color: var(--color-primary);
      font-weight: var(--font-weight-semibold);
      transition: color var(--transition-base);
    }

    .symbol-link:hover strong {
      color: var(--color-primary-dark);
      text-decoration: underline;
    }

    .symbol-link:focus {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }

    .price-cell {
      font-weight: var(--font-weight-semibold);
    }

    .price-value {
      color: var(--color-text-primary);
      font-size: var(--font-size-base);
    }

    .change-value,
    .change-percent {
      font-weight: var(--font-weight-medium);
      font-size: var(--font-size-sm);
    }

    .volume-cell {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .date-cell {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .actions-cell {
      white-space: nowrap;
    }

    .action-buttons {
      display: flex;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
    }

    @media (max-width: 768px) {
      .watchlist {
        padding: var(--spacing-lg) 0;
      }

      .watchlist-header {
        flex-direction: column;
        margin-bottom: var(--spacing-xl);
      }

      .watchlist-subtitle {
        font-size: var(--font-size-base);
      }

      .table-wrapper {
        font-size: var(--font-size-xs);
      }

      .action-buttons {
        flex-direction: column;
      }

      .action-buttons .btn {
        width: 100%;
      }
    }
  `]
})
export class WatchlistComponent implements OnInit {
  watchlistItems: WatchlistItem[] = [];
  stockQuotes: StockQuote[] = [];
  loading = false;

  constructor(
    private watchlistService: WatchlistService,
    private stockService: StockService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadWatchlist();
  }

  private loadWatchlist(): void {
    this.loading = true;
    this.watchlistService.getWatchlist().subscribe(items => {
      this.watchlistItems = items;
      
      if (items.length > 0) {
        const symbols = items.map(item => item.symbol);
        this.stockService.getMultipleQuotes(symbols).subscribe(quotes => {
          // Sort quotes to match watchlist order
          this.stockQuotes = symbols
            .map(symbol => quotes.find(q => q.symbol === symbol))
            .filter(q => q !== undefined) as StockQuote[];
          this.loading = false;
        });
      } else {
        this.loading = false;
      }
    });
  }

  viewStock(symbol: string): void {
    this.router.navigate(['/stock', symbol]);
  }

  removeFromWatchlist(symbol: string): void {
    this.watchlistService.removeFromWatchlist(symbol);
    this.loadWatchlist();
  }

  getAddedDate(symbol: string): Date {
    const item = this.watchlistItems.find(i => i.symbol === symbol);
    return item ? item.addedDate : new Date();
  }
}

