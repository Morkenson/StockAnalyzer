import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { StockService } from '../services/stock.service';
import { WatchlistService } from '../services/watchlist.service';
import { StockSearchResult } from '../models/stock.model';

@Component({
  selector: 'app-stock-search',
  template: `
    <div class="stock-search">
      <div class="search-header">
        <h1>Search Stocks</h1>
        <p class="search-subtitle">Find stocks by symbol or company name</p>
      </div>
      
      <div class="card search-card">
        <div class="input-group">
          <label for="searchInput">Search by symbol or company name</label>
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input 
              id="searchInput"
              type="text" 
              [formControl]="searchControl"
              placeholder="e.g., AAPL, Apple, Microsoft"
              class="search-input"
              autocomplete="off"
              aria-label="Search stocks">
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="card loading-card">
        <div class="loading-content">
          <div class="spinner"></div>
          <p>Searching...</p>
        </div>
      </div>

      <div *ngIf="searchResults.length > 0" class="card results-card">
        <div class="card-header">
          <span>Search Results</span>
          <span class="results-count">{{ searchResults.length }} found</span>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Company Name</th>
                <th>Exchange</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let result of searchResults" class="result-row">
                <td>
                  <strong class="symbol-text">{{ result.symbol }}</strong>
                </td>
                <td class="company-name">{{ result.name }}</td>
                <td><span class="exchange-badge">{{ result.exchange }}</span></td>
                <td><span class="type-badge">{{ result.type }}</span></td>
                <td class="actions-cell">
                  <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" (click)="viewStock(result.symbol)">
                      View
                    </button>
                    <button 
                      *ngIf="!isInWatchlist(result.symbol)"
                      class="btn btn-secondary btn-sm" 
                      (click)="addToWatchlist(result.symbol)"
                      [attr.aria-label]="'Add ' + result.symbol + ' to watchlist'">
                      + Watchlist
                    </button>
                    <span *ngIf="isInWatchlist(result.symbol)" class="watchlist-badge" [attr.aria-label]="result.symbol + ' is in watchlist'">
                      <span class="check-icon">✓</span> In Watchlist
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div *ngIf="searchResults.length === 0 && searchControl.value && !loading" class="card empty-results-card">
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try searching with a different symbol or company name</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stock-search {
      padding: var(--spacing-xl) 0;
    }

    .search-header {
      margin-bottom: var(--spacing-2xl);
    }

    .search-header h1 {
      margin-bottom: var(--spacing-sm);
    }

    .search-subtitle {
      font-size: var(--font-size-lg);
      color: var(--color-text-secondary);
      margin-bottom: 0;
    }

    .search-card {
      margin-bottom: var(--spacing-lg);
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: var(--spacing-md);
      font-size: var(--font-size-lg);
      color: var(--color-text-tertiary);
      pointer-events: none;
      z-index: 1;
    }

    .search-input {
      padding-left: calc(var(--spacing-md) * 2 + 1.5rem);
      font-size: var(--font-size-lg);
      padding-top: var(--spacing-md);
      padding-bottom: var(--spacing-md);
    }

    .loading-card {
      text-align: center;
    }

    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-xl) 0;
    }

    .loading-content p {
      color: var(--color-text-secondary);
      margin: 0;
    }

    .results-card {
      margin-bottom: var(--spacing-lg);
    }

    .results-count {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      font-weight: var(--font-weight-normal);
    }

    .table-wrapper {
      overflow-x: auto;
      margin-top: var(--spacing-md);
    }

    .result-row {
      transition: background-color var(--transition-fast);
    }

    .result-row:hover {
      background-color: var(--color-bg-tertiary);
    }

    .symbol-text {
      color: var(--color-primary);
      font-weight: var(--font-weight-semibold);
      font-size: var(--font-size-base);
    }

    .company-name {
      color: var(--color-text-primary);
      font-weight: var(--font-weight-medium);
    }

    .exchange-badge,
    .type-badge {
      display: inline-block;
      padding: var(--spacing-xs) var(--spacing-sm);
      background-color: var(--color-bg-tertiary);
      color: var(--color-text-secondary);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
    }

    .actions-cell {
      white-space: nowrap;
    }

    .action-buttons {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
    }

    .watchlist-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      color: var(--color-success);
      font-weight: var(--font-weight-medium);
      font-size: var(--font-size-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      background-color: rgba(16, 185, 129, 0.1);
      border-radius: var(--radius-sm);
    }

    .check-icon {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-bold);
    }

    .empty-results-card {
      text-align: center;
    }

    @media (max-width: 768px) {
      .stock-search {
        padding: var(--spacing-lg) 0;
      }

      .search-header {
        margin-bottom: var(--spacing-xl);
      }

      .search-subtitle {
        font-size: var(--font-size-base);
      }

      .action-buttons {
        flex-direction: column;
        align-items: stretch;
      }

      .action-buttons .btn {
        width: 100%;
      }
    }
  `]
})
export class StockSearchComponent implements OnInit {
  searchControl = new FormControl('');
  searchResults: StockSearchResult[] = [];
  loading = false;

  constructor(
    private stockService: StockService,
    private watchlistService: WatchlistService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check for query parameter from header search
    this.route.queryParams.subscribe((params: { [key: string]: any }) => {
      if (params['q']) {
        this.searchControl.setValue(params['q'], { emitEvent: false });
        this.performSearch(params['q']);
      }
    });

    // Handle real-time search as user types
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => {
          this.loading = true;
          if (!query || query.trim().length < 1) {
            this.searchResults = [];
            this.loading = false;
            return [];
          }
          return this.stockService.searchStocks(query.trim());
        })
      )
      .subscribe(results => {
        this.searchResults = results as StockSearchResult[];
        this.loading = false;
      });
  }

  private performSearch(query: string): void {
    if (!query || query.trim().length < 1) {
      this.searchResults = [];
      this.loading = false;
      return;
    }

    this.loading = true;
    this.stockService.searchStocks(query.trim()).subscribe({
      next: (results) => {
        this.searchResults = results as StockSearchResult[];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error searching stocks:', error);
        this.searchResults = [];
        this.loading = false;
      }
    });
  }

  viewStock(symbol: string): void {
    this.router.navigate(['/stock', symbol]);
  }

  addToWatchlist(symbol: string): void {
    this.watchlistService.addToWatchlist(symbol);
  }

  isInWatchlist(symbol: string): boolean {
    return this.watchlistService.isInWatchlist(symbol);
  }
}

