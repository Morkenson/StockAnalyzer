import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StockService } from '../../services/stock.service';
import { WatchlistService } from '../../services/watchlist.service';
import { Stock, StockHistoricalData, Watchlist } from '../../models/stock.model';
import { Subscription } from 'rxjs';

type ChartRange = {
  label: string;
  interval: '1min' | '5min' | '30min' | '1d' | '1w';
  outputSize: number;
  daysBack: number;
};

@Component({
  selector: 'app-stock-details',
  template: `
    <div class="stock-details" *ngIf="stock">
      <section class="card stock-detail-hero">
        <div class="stock-header">
          <div class="stock-info">
            <h1>{{ getStockTitle() }}</h1>
            <p class="stock-name">{{ stock.symbol }}</p>
            <span class="stock-exchange" *ngIf="shouldShowExchange()">{{ stock.exchange }}</span>
          </div>
          <div class="stock-price-section">
            <div class="stock-price" [class.positive]="stock.change && stock.change >= 0" 
                 [class.negative]="stock.change && stock.change < 0">
              {{ '$' + (stock.currentPrice | number:'1.2-2') }}
            </div>
            <div *ngIf="stock.change !== undefined && stock.changePercent !== undefined" class="stock-change" 
                 [class.positive]="stock.change >= 0" 
                 [class.negative]="stock.change < 0">
              <span class="change-arrow">{{ stock.change >= 0 ? 'UP' : 'DOWN' }}</span>
              <span>{{ stock.change >= 0 ? '+' : '' }}{{ stock.change | number:'1.2-2' }}</span>
              <span>({{ stock.changePercent >= 0 ? '+' : '' }}{{ stock.changePercent | number:'1.2-2' }}%)</span>
            </div>
          </div>
        </div>

        <div class="stock-chart-section">
          <div class="chart-topline">
            <div>
              <span class="chart-eyebrow">Price history</span>
              <strong [class.positive]="chartChange >= 0" [class.negative]="chartChange < 0">
                {{ chartChange >= 0 ? '+' : '' }}{{ chartChange | currency:'USD':'symbol':'1.2-2' }}
                <span>({{ chartChangePercent >= 0 ? '+' : '' }}{{ chartChangePercent | number:'1.2-2' }}%)</span>
              </strong>
            </div>
            <span class="chart-range-label">{{ selectedRange.label }}</span>
          </div>
          <app-stock-chart [historicalData]="historicalData"></app-stock-chart>
          <div class="chart-range-tabs" role="tablist" aria-label="Stock chart timeframe">
            <button
              *ngFor="let range of chartRanges"
              type="button"
              role="tab"
              class="chart-range-tab"
              [class.active]="range.label === selectedRange.label"
              [attr.aria-selected]="range.label === selectedRange.label"
              [disabled]="historicalLoading && range.label === selectedRange.label"
              (click)="selectRange(range)">
              {{ range.label }}
            </button>
          </div>
          <div class="chart-loading" *ngIf="historicalLoading">Updating chart...</div>
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
      </section>

      <div class="stock-detail-grid">
        <section class="card">
          <div class="card-header">
            <div>
              <span>Key Metrics</span>
              <p>Company fundamentals</p>
            </div>
          </div>
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
        </section>

        <section class="card" *ngIf="stock.description">
          <div class="card-header">About</div>
          <p>{{ stock.description }}</p>
        </section>
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
  historicalLoading = false;
  chartChange = 0;
  chartChangePercent = 0;
  chartRanges: ChartRange[] = [
    { label: '1D', interval: '1min', outputSize: 390, daysBack: 1 },
    { label: '1W', interval: '30min', outputSize: 90, daysBack: 7 },
    { label: '1M', interval: '1d', outputSize: 30, daysBack: 30 },
    { label: '3M', interval: '1d', outputSize: 90, daysBack: 90 },
    { label: '1Y', interval: '1d', outputSize: 252, daysBack: 365 },
    { label: '5Y', interval: '1w', outputSize: 260, daysBack: 365 * 5 }
  ];
  selectedRange = this.chartRanges[2];
  private subscriptions = new Subscription();
  private historicalDataCache = new Map<string, StockHistoricalData[]>();

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
      this.historicalDataCache.clear();
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

  shouldShowStockName(): boolean {
    const name = this.stock?.name?.trim();
    return !!name && name.toUpperCase() !== this.symbol.toUpperCase();
  }

  getStockTitle(): string {
    return this.shouldShowStockName() ? this.stock!.name : this.symbol;
  }

  shouldShowExchange(): boolean {
    const exchange = this.stock?.exchange?.trim();
    return !!exchange && exchange.toLowerCase() !== 'unknown';
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

    this.loadHistoricalData();
  }

  selectRange(range: ChartRange): void {
    if (range.label === this.selectedRange.label) {
      return;
    }

    this.selectedRange = range;
    this.loadHistoricalData();
  }

  private loadHistoricalData(): void {
    const cacheKey = this.getHistoricalCacheKey(this.selectedRange);
    const cachedData = this.historicalDataCache.get(cacheKey);
    if (cachedData) {
      this.historicalData = cachedData;
      this.updateChartChange();
      this.historicalLoading = false;
      return;
    }

    this.historicalLoading = true;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.selectedRange.daysBack);

    this.stockService.getHistoricalData(
      this.symbol,
      startDate,
      endDate,
      this.selectedRange.interval,
      false,
      this.selectedRange.outputSize
    ).subscribe({
      next: (data) => {
        this.historicalData = data;
        this.historicalDataCache.set(cacheKey, data);
        this.updateChartChange();
        this.historicalLoading = false;
      },
      error: (err) => {
        console.error('Failed to load historical data:', err);
        this.historicalLoading = false;
      }
    });
  }

  private getHistoricalCacheKey(range: ChartRange): string {
    return `${this.symbol.toUpperCase()}_${range.label}_${range.interval}_${range.outputSize}`;
  }

  private updateChartChange(): void {
    if (!this.historicalData || this.historicalData.length < 2) {
      this.chartChange = this.stock?.change || 0;
      this.chartChangePercent = this.stock?.changePercent || 0;
      return;
    }

    const sorted = [...this.historicalData].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstClose = sorted[0].close;
    const lastClose = sorted[sorted.length - 1].close;

    this.chartChange = lastClose - firstClose;
    this.chartChangePercent = firstClose ? (this.chartChange / firstClose) * 100 : 0;
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

