import { Component, Input } from '@angular/core';
import { StockQuote } from '../../../models/stock.model';
import { WatchlistService } from '../../../services/watchlist.service';
import { Router } from '@angular/router';

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
        <button 
          *ngIf="showAddToWatchlist && !isInWatchlist"
          class="btn btn-sm btn-secondary watchlist-btn" 
          (click)="addToWatchlist()"
          [attr.aria-label]="'Add ' + stock.symbol + ' to watchlist'">
          <span class="btn-icon">+</span>
          <span>Watchlist</span>
        </button>
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
export class StockCardComponent {
  @Input() stock!: StockQuote;
  @Input() showAddToWatchlist = false;
  isInWatchlist = false;

  constructor(
    private watchlistService: WatchlistService,
    private router: Router
  ) {
    // Check watchlist status
    if (this.stock) {
      this.watchlistService.getWatchlist().subscribe(watchlist => {
        this.isInWatchlist = watchlist.some(item => item.symbol === this.stock.symbol);
      });
    }
  }

  viewStock(): void {
    this.router.navigate(['/stock', this.stock.symbol]);
  }

  addToWatchlist(): void {
    this.watchlistService.addToWatchlist(this.stock.symbol);
    this.isInWatchlist = true;
  }
}

