import { Component, OnInit } from '@angular/core';
import { StockService } from '../services/stock.service';
import { WatchlistService } from '../services/watchlist.service';
import { StockQuote } from '../models/stock.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="dashboard">
      <h1>Dashboard</h1>
      
      <div class="card" *ngIf="popularStocks$ | async as stocks">
        <div class="card-header">Popular Stocks</div>
        <div class="grid grid-3">
          <app-stock-card 
            *ngFor="let stock of stocks" 
            [stock]="stock"
            [showAddToWatchlist]="true">
          </app-stock-card>
        </div>
      </div>

      <div class="card" *ngIf="watchlistQuotes$ | async as quotes">
        <div class="card-header">Your Watchlist</div>
        <div *ngIf="quotes.length === 0" class="empty-state">
          <p>Your watchlist is empty. Add stocks from the search page!</p>
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
        <p>TODO: Add market overview widgets (indices, trending stocks, etc.)</p>
      </div>
    </div>
  `,
  styles: [`
    .dashboard h1 {
      margin-bottom: 2rem;
      color: #333;
    }

    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #666;
    }
  `]
})
export class DashboardComponent implements OnInit {
  popularStocks$!: Observable<StockQuote[]>;
  watchlistQuotes$!: Observable<StockQuote[]>;

  // Popular stocks to display
  private popularSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META'];

  constructor(
    private stockService: StockService,
    private watchlistService: WatchlistService
  ) {}

  ngOnInit(): void {
    // Load popular stocks
    this.loadPopularStocks();
    
    // Load watchlist stocks
    this.loadWatchlistStocks();
  }

  private loadPopularStocks(): void {
    // TODO: Implement actual API call
    this.popularStocks$ = this.stockService.getMultipleQuotes(this.popularSymbols);
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

