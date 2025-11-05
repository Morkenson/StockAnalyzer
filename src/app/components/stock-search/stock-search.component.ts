import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { StockService } from '../../services/stock.service';
import { WatchlistService } from '../../services/watchlist.service';
import { StockSearchResult } from '../../models/stock.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-stock-search',
  template: `
    <div class="stock-search">
      <h1>Search Stocks</h1>
      
      <div class="card">
        <div class="input-group">
          <label for="searchInput">Search by symbol or company name</label>
          <input 
            id="searchInput"
            type="text" 
            [formControl]="searchControl"
            placeholder="e.g., AAPL, Apple, Microsoft"
            class="search-input">
        </div>
      </div>

      <div *ngIf="loading" class="card">
        <div class="spinner"></div>
      </div>

      <div *ngIf="searchResults.length > 0" class="card">
        <div class="card-header">Search Results</div>
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
            <tr *ngFor="let result of searchResults">
              <td><strong>{{ result.symbol }}</strong></td>
              <td>{{ result.name }}</td>
              <td>{{ result.exchange }}</td>
              <td>{{ result.type }}</td>
              <td>
                <button class="btn btn-primary" (click)="viewStock(result.symbol)">
                  View Details
                </button>
                <button 
                  *ngIf="!isInWatchlist(result.symbol)"
                  class="btn btn-secondary" 
                  (click)="addToWatchlist(result.symbol)">
                  Add to Watchlist
                </button>
                <span *ngIf="isInWatchlist(result.symbol)" class="watchlist-badge">
                  ✓ In Watchlist
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="searchResults.length === 0 && searchControl.value && !loading" class="card">
        <p>No results found. Try a different search term.</p>
      </div>
    </div>
  `,
  styles: [`
    .stock-search h1 {
      margin-bottom: 2rem;
      color: #333;
    }

    .search-input {
      font-size: 1.1rem;
      padding: 1rem;
    }

    .watchlist-badge {
      color: #28a745;
      font-weight: 500;
      margin-left: 0.5rem;
    }

    .table td {
      vertical-align: middle;
    }

    .table td button {
      margin-right: 0.5rem;
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
    private router: Router
  ) {}

  ngOnInit(): void {
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

