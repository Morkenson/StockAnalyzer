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
          <span>Market Overview</span>
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
          <p>Market overview data is loading...</p>
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

    </div>
  `,
  styleUrls: ['../styles/components/dashboard.component.scss']
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

