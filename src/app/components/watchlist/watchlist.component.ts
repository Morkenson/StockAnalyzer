import { Component, OnInit } from '@angular/core';
import { StockService } from '../../services/stock.service';
import { WatchlistService } from '../../services/watchlist.service';
import { WatchlistItem, StockQuote } from '../../models/stock.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-watchlist',
  template: `
    <div class="watchlist">
      <h1>My Watchlist</h1>
      
      <div class="card" *ngIf="watchlistItems.length === 0">
        <div class="empty-state">
          <p>Your watchlist is empty.</p>
          <p>Search for stocks and add them to your watchlist to track them here.</p>
          <button class="btn btn-primary" routerLink="/search">Search Stocks</button>
        </div>
      </div>

      <div *ngIf="watchlistItems.length > 0" class="card">
        <div class="card-header">Watchlist ({{ watchlistItems.length }} stocks)</div>
        
        <div *ngIf="loading" class="spinner"></div>
        
        <div *ngIf="!loading && stockQuotes.length > 0" class="watchlist-table">
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
              <tr *ngFor="let quote of stockQuotes; let i = index">
                <td>
                  <strong (click)="viewStock(quote.symbol)" style="cursor: pointer; color: #667eea;">
                    {{ quote.symbol }}
                  </strong>
                </td>
                <td>{{ '$' + (quote.price | number:'1.2-2') }}</td>
                <td [class.positive]="quote.change >= 0" [class.negative]="quote.change < 0">
                  {{ quote.change >= 0 ? '+' : '' }}{{ quote.change | number:'1.2-2' }}
                </td>
                <td [class.positive]="quote.changePercent >= 0" [class.negative]="quote.changePercent < 0">
                  {{ quote.changePercent >= 0 ? '+' : '' }}{{ quote.changePercent | number:'1.2-2' }}%
                </td>
                <td>{{ quote.volume | number }}</td>
                <td>{{ getAddedDate(quote.symbol) | date:'shortDate' }}</td>
                <td>
                  <button class="btn btn-primary" (click)="viewStock(quote.symbol)">View</button>
                  <button class="btn btn-secondary" (click)="removeFromWatchlist(quote.symbol)">Remove</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .watchlist h1 {
      margin-bottom: 2rem;
      color: #333;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #666;
    }

    .empty-state p {
      margin-bottom: 1rem;
    }

    .watchlist-table {
      overflow-x: auto;
    }

    .table td strong:hover {
      text-decoration: underline;
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

