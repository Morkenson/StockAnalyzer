import { Component, Input, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { StockQuote, Watchlist } from '../../../models/stock.model';
import { WatchlistService } from '../../../services/watchlist.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-stock-card',
  template: `
    <div class="stock-card">
      <div class="stock-card-header">
        <button 
          class="symbol-button"
          (click)="viewStock()"
          [attr.aria-label]="'View details for ' + stock.symbol">
          <h3>{{ stock.symbol }}</h3>
        </button>
        <div class="watchlist-dropdown-wrapper" *ngIf="showAddToWatchlist && !isInWatchlist">
          <button 
            class="btn btn-sm btn-secondary watchlist-btn" 
            (click)="toggleWatchlistDropdown()"
            [attr.aria-label]="'Add ' + stock.symbol + ' to watchlist'"
            [attr.aria-expanded]="showDropdown">
            <span class="btn-icon">+</span>
            <span>Watchlist</span>
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
                [attr.aria-label]="'Add ' + stock.symbol + ' to ' + wl.name">
                <span>{{ wl.name }}</span>
                <span *ngIf="wl.isDefault" class="default-badge">Default</span>
              </button>
            </div>
            <div class="dropdown-empty" *ngIf="watchlists.length === 0">
              <p>No watchlists available</p>
            </div>
          </div>
        </div>
        <span 
          *ngIf="showAddToWatchlist && isInWatchlist" 
          class="watchlist-indicator"
          [attr.aria-label]="stock.symbol + ' is in watchlist'">
          <span class="check-icon">✓</span>
        </span>
      </div>
      
      <div class="stock-card-body">
        <div class="stock-card-price">
          <span class="price" [class.positive]="stock.changePercent >= 0" 
                [class.negative]="stock.changePercent < 0">
            {{ '$' + (stock.price | number:'1.2-2') }}
          </span>
          <span class="change" [class.positive]="stock.changePercent >= 0" 
                [class.negative]="stock.changePercent < 0">
            <span class="change-arrow">{{ stock.changePercent >= 0 ? '↑' : '↓' }}</span>
            {{ stock.changePercent >= 0 ? '+' : '' }}{{ stock.changePercent | number:'1.2-2' }}%
          </span>
        </div>
      </div>
      
      <div class="stock-card-footer">
        <div class="footer-item">
          <span class="footer-label">Volume</span>
          <span class="footer-value">{{ stock.volume | number }}</span>
        </div>
        <div class="footer-item">
          <span class="footer-label">Updated</span>
          <span class="footer-value">{{ stock.timestamp | date:'short' }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stock-card {
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-lg);
      transition: all var(--transition-base);
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .stock-card:hover {
      box-shadow: var(--shadow-md);
      border-color: var(--color-primary-light);
      transform: translateY(-2px);
    }

    .stock-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-lg);
      gap: var(--spacing-sm);
    }

    .symbol-button {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
      flex: 1;
      font-family: inherit;
    }

    .symbol-button h3 {
      margin: 0;
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-primary);
      transition: color var(--transition-base);
      letter-spacing: -0.01em;
    }

    .symbol-button:hover h3 {
      color: var(--color-primary-dark);
    }

    .symbol-button:focus {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }

    .watchlist-dropdown-wrapper {
      position: relative;
    }

    .watchlist-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      white-space: nowrap;
    }

    .btn-icon {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-bold);
    }

    .watchlist-dropdown {
      position: absolute;
      top: calc(100% + var(--spacing-xs));
      right: 0;
      min-width: 200px;
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
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

    .watchlist-indicator {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background-color: rgba(16, 185, 129, 0.1);
      color: var(--color-success);
      border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
    }

    .check-icon {
      font-weight: var(--font-weight-bold);
    }

    .stock-card-body {
      flex: 1;
      margin-bottom: var(--spacing-md);
    }

    .stock-card-price {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .stock-card-price .price {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      line-height: var(--line-height-tight);
      letter-spacing: -0.02em;
    }

    .stock-card-price .change {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
    }

    .change-arrow {
      font-size: var(--font-size-base);
    }

    .stock-card-footer {
      display: flex;
      justify-content: space-between;
      gap: var(--spacing-md);
      padding-top: var(--spacing-md);
      border-top: 1px solid var(--color-border-light);
      font-size: var(--font-size-xs);
    }

    .footer-item {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .footer-label {
      color: var(--color-text-tertiary);
      font-weight: var(--font-weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.7rem;
    }

    .footer-value {
      color: var(--color-text-secondary);
      font-weight: var(--font-weight-medium);
    }

    .positive {
      color: var(--color-success);
    }

    .negative {
      color: var(--color-danger);
    }

    @media (max-width: 768px) {
      .stock-card {
        padding: var(--spacing-md);
      }

      .stock-card-price .price {
        font-size: var(--font-size-xl);
      }
    }
  `]
})
export class StockCardComponent implements OnInit, OnDestroy {
  @ViewChild('watchlistDropdown', { static: false }) watchlistDropdown?: ElementRef;
  
  @Input() stock!: StockQuote;
  @Input() showAddToWatchlist = false;
  isInWatchlist = false;
  watchlists: Watchlist[] = [];
  showDropdown = false;
  private subscriptions = new Subscription();

  constructor(
    private watchlistService: WatchlistService,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Load watchlists
    this.subscriptions.add(
      this.watchlistService.getWatchlists().subscribe(watchlists => {
        this.watchlists = watchlists;
      })
    );

    // Check watchlist status
    this.subscriptions.add(
      this.watchlistService.getWatchlist().subscribe(watchlist => {
        this.isInWatchlist = watchlist.some(item => item.symbol === this.stock.symbol);
      })
    );
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

  viewStock(): void {
    this.router.navigate(['/stock', this.stock.symbol]);
  }

  async addToWatchlist(watchlistId: string): Promise<void> {
    try {
      await this.watchlistService.addToWatchlist(this.stock.symbol, undefined, watchlistId);
      this.showDropdown = false;
      // Watchlist status will be updated automatically via subscription
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  }
}

