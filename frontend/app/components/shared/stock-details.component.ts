import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { WatchlistService } from '../../services/watchlist.service';
import { Stock, StockHistoricalData, Watchlist } from '../../models/stock.model';
import { Subscription } from 'rxjs';

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

        <div class="stock-chart-section">
          <app-stock-chart [historicalData]="historicalData"></app-stock-chart>
        </div>

        <div class="stock-actions">
          <div class="watchlist-dropdown-wrapper" *ngIf="!isInWatchlist">
            <button 
              class="btn btn-primary" 
              (click)="toggleWatchlistDropdown()"
              [attr.aria-expanded]="showDropdown">
              Add to Watchlist
            </button>
            <div class="watchlist-dropdown" *ngIf="showDropdown" #watchlistDropdown>
              <div class="dropdown-header">
                <span>Add to Watchlist</span>
              </div>
              <div class="dropdown-list" *ngIf="watchlists.length > 0">
                <button 
                  *ngFor="let wl of watchlists"
                  class="dropdown-item"
                  (click)="addToWatchlist(wl.id)"
                  [attr.aria-label]="'Add ' + symbol + ' to ' + wl.name">
                  <span>{{ wl.name }}</span>
                  <span *ngIf="wl.isDefault" class="default-badge">Default</span>
                </button>
              </div>
              <div class="dropdown-empty" *ngIf="watchlists.length === 0">
                <p>No watchlists available</p>
              </div>
            </div>
          </div>
          <button 
            *ngIf="isInWatchlist"
            class="btn btn-secondary" 
            (click)="removeFromWatchlist()">
            Remove from Watchlist
          </button>
        </div>
      </div>

        <div class="card">
        <div class="card-header">Financial Metrics</div>
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
          <tr *ngIf="stock.averageVolume">
            <td>Average Volume</td>
            <td>{{ stock.averageVolume | number }}</td>
            </tr>
          </table>
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
  styleUrls: ['../../styles/components/shared/stock-details.component.scss']
})
export class StockDetailsComponent implements OnInit, OnDestroy {
  @ViewChild('watchlistDropdown', { static: false }) watchlistDropdown?: ElementRef;
  
  stock: Stock | null = null;
  historicalData: StockHistoricalData[] = [];
  loading = true;
  error: string | null = null;
  isInWatchlist = false;
  symbol: string = '';
  watchlists: Watchlist[] = [];
  showDropdown = false;
  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private stockService: StockService,
    private watchlistService: WatchlistService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Load watchlists
    this.subscriptions.add(
      this.watchlistService.getWatchlists().subscribe(watchlists => {
        this.watchlists = watchlists;
      })
    );

    this.route.params.subscribe(params => {
      this.symbol = params['symbol'];
      this.loadStockData();
      this.checkWatchlistStatus();
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showDropdown && this.watchlistDropdown) {
      const clickedInside = this.elementRef.nativeElement.contains(event.target);
      if (!clickedInside) {
        this.showDropdown = false;
      }
    }
  }

  toggleWatchlistDropdown(): void {
    this.showDropdown = !this.showDropdown;
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

  async addToWatchlist(watchlistId: string): Promise<void> {
    try {
      await this.watchlistService.addToWatchlist(this.symbol, undefined, watchlistId);
      this.showDropdown = false;
      // Watchlist status will be updated automatically via subscription
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  }

  async removeFromWatchlist(): Promise<void> {
    try {
      await this.watchlistService.removeFromWatchlist(this.symbol);
      // Watchlist status will be updated automatically via subscription
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  }
}

