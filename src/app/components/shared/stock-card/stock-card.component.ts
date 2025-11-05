import { Component, Input } from '@angular/core';
import { StockQuote } from '../../../models/stock.model';
import { WatchlistService } from '../../../services/watchlist.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-stock-card',
  template: `
    <div class="stock-card">
      <div class="stock-card-header">
        <h3 (click)="viewStock()" style="cursor: pointer; color: #667eea;">
          {{ stock.symbol }}
        </h3>
        <button 
          *ngIf="showAddToWatchlist && !isInWatchlist"
          class="btn btn-sm btn-secondary" 
          (click)="addToWatchlist()">
          + Watchlist
        </button>
      </div>
      
      <div class="stock-card-price">
        <span class="price" [class.positive]="stock.changePercent >= 0" 
              [class.negative]="stock.changePercent < 0">
          {{ '$' + (stock.price | number:'1.2-2') }}
        </span>
        <span class="change" [class.positive]="stock.changePercent >= 0" 
              [class.negative]="stock.changePercent < 0">
          {{ stock.changePercent >= 0 ? '+' : '' }}{{ stock.changePercent | number:'1.2-2' }}%
        </span>
      </div>
      
      <div class="stock-card-footer">
        <span>Vol: {{ stock.volume | number }}</span>
        <span>{{ stock.timestamp | date:'short' }}</span>
      </div>
    </div>
  `,
  styles: [`
    .stock-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1rem;
      transition: box-shadow 0.3s;
    }

    .stock-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .stock-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .stock-card-header h3 {
      margin: 0;
      font-size: 1.1rem;
    }

    .stock-card-price {
      margin-bottom: 0.75rem;
    }

    .stock-card-price .price {
      font-size: 1.5rem;
      font-weight: bold;
      display: block;
      margin-bottom: 0.25rem;
    }

    .stock-card-price .change {
      font-size: 0.9rem;
    }

    .stock-card-footer {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #666;
      padding-top: 0.5rem;
      border-top: 1px solid #eee;
    }

    .btn-sm {
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
    }

    .positive {
      color: #28a745;
    }

    .negative {
      color: #dc3545;
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

