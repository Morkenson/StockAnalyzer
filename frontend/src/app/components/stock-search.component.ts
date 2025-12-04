import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { StockService } from '../services/stock.service';
import { WatchlistService } from '../services/watchlist.service';
import { StockSearchResult, Watchlist } from '../models/stock.model';
import { Subscription } from 'rxjs';

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
              <tr *ngFor="let result of searchResults; trackBy: trackBySymbol; let i = index" 
                  class="result-row"
                  (click)="viewStock(result.symbol)"
                  [attr.aria-label]="'View details for ' + result.symbol">
                <td>
                  <strong class="symbol-text">{{ result.symbol }}</strong>
                </td>
                <td class="company-name">{{ result.name }}</td>
                <td><span class="exchange-badge">{{ result.exchange }}</span></td>
                <td><span class="type-badge">{{ result.type }}</span></td>
                <td class="actions-cell" (click)="$event.stopPropagation()">
                  <div class="action-buttons">
                    <div class="watchlist-dropdown-wrapper" *ngIf="!isInWatchlist(result.symbol)">
                      <button 
                        class="btn btn-secondary btn-sm" 
                        (click)="toggleWatchlistDropdown(getRowId(i, result), result.symbol, $event)"
                        [attr.aria-label]="'Add ' + result.symbol + ' to watchlist'"
                        [attr.aria-expanded]="openDropdownId === getRowId(i, result)">
                        + Watchlist
                      </button>
                      <div class="watchlist-dropdown" 
                           *ngIf="openDropdownId === getRowId(i, result)"
                           (click)="$event.stopPropagation()">
                        <div class="dropdown-header">
                          <span>Add to Watchlist</span>
                        </div>
                        <div class="dropdown-list" *ngIf="watchlists.length > 0">
                          <button 
                            *ngFor="let wl of watchlists"
                            class="dropdown-item"
                            (click)="addToWatchlist(result.symbol, wl.id); $event.stopPropagation()"
                            [attr.aria-label]="'Add ' + result.symbol + ' to ' + wl.name">
                            <span>{{ wl.name }}</span>
                            <span *ngIf="wl.isDefault" class="default-badge">Default</span>
                          </button>
                        </div>
                        <div class="dropdown-empty" *ngIf="watchlists.length === 0">
                          <p>No watchlists available</p>
                        </div>
                      </div>
                    </div>
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
      overflow-y: visible;
    }

    .result-row {
      transition: background-color var(--transition-fast);
      cursor: pointer;
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
      position: relative;
      z-index: 1;
    }

    .actions-cell button {
      cursor: pointer;
    }

    .result-row {
      position: relative;
    }

    .result-row .watchlist-dropdown-wrapper {
      z-index: 1002;
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

    .watchlist-dropdown-wrapper {
      position: relative;
      display: inline-block;
      isolation: isolate;
    }

    .watchlist-dropdown {
      position: absolute;
      top: calc(100% + var(--spacing-xs));
      right: 0;
      min-width: 200px;
      max-width: 250px;
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1001;
      overflow: hidden;
      animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dropdown-header {
      padding: var(--spacing-md);
      background: var(--color-bg-tertiary);
      border-bottom: 1px solid var(--color-border);
      font-weight: var(--font-weight-semibold);
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
    }

    .dropdown-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .dropdown-item {
      width: 100%;
      padding: var(--spacing-md);
      background: transparent;
      border: none;
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      text-align: left;
      cursor: pointer;
      transition: background-color var(--transition-base);
      font-family: var(--font-family);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .dropdown-item:hover {
      background: var(--color-bg-tertiary);
    }

    .dropdown-item:active {
      background: var(--color-bg-secondary);
    }

    .default-badge {
      font-size: var(--font-size-xs);
      color: var(--color-text-tertiary);
      font-weight: var(--font-weight-normal);
    }

    .dropdown-empty {
      padding: var(--spacing-md);
      text-align: center;
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
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
export class StockSearchComponent implements OnInit, OnDestroy {
  searchControl = new FormControl('');
  searchResults: StockSearchResult[] = [];
  loading = false;
  watchlists: Watchlist[] = [];
  openDropdownId: string | null = null;
  private subscriptions = new Subscription();

  constructor(
    private stockService: StockService,
    private watchlistService: WatchlistService,
    private router: Router,
    private route: ActivatedRoute,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Load watchlists
    this.subscriptions.add(
      this.watchlistService.getWatchlists().subscribe(watchlists => {
        this.watchlists = watchlists;
      })
    );

    // Check for query parameter from header search
    this.subscriptions.add(
      this.route.queryParams.subscribe((params: { [key: string]: any }) => {
        if (params['q']) {
          this.searchControl.setValue(params['q'], { emitEvent: false });
          this.performSearch(params['q']);
        }
      })
    );

    // Handle real-time search as user types
    this.subscriptions.add(
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
          // Close any open dropdown when search results change
          this.openDropdownId = null;
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.openDropdownId) {
      const target = event.target as HTMLElement;
      // Check if click is outside any dropdown wrapper or dropdown itself
      const clickedInsideDropdown = target.closest('.watchlist-dropdown-wrapper') || 
                                   target.closest('.watchlist-dropdown');
      if (!clickedInsideDropdown) {
        this.openDropdownId = null;
      }
    }
  }

  toggleWatchlistDropdown(rowId: string, symbol: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // If clicking the same row, close it. Otherwise, open the new one (which closes any other)
    if (this.openDropdownId === rowId) {
      this.openDropdownId = null;
    } else {
      this.openDropdownId = rowId;
    }
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

  async addToWatchlist(symbol: string, watchlistId: string): Promise<void> {
    try {
      await this.watchlistService.addToWatchlist(symbol, undefined, watchlistId);
      this.openDropdownId = null;
      // Watchlist status will be updated automatically via subscription
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  }

  isInWatchlist(symbol: string): boolean {
    return this.watchlistService.isInWatchlist(symbol);
  }

  trackBySymbol(index: number, result: StockSearchResult): string {
    // Create unique identifier using symbol, exchange, and index
    return `${result.symbol}-${result.exchange}-${index}`;
  }

  getRowId(index: number, result: StockSearchResult): string {
    // Create unique identifier for each row
    return `${result.symbol}-${result.exchange}-${index}`;
  }
}


