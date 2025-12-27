import { Component, Input, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { StockQuote, Watchlist } from '../../models/stock.model';
import { WatchlistService } from '../../services/watchlist.service';
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
  styleUrls: ['../../styles/components/shared/stock-card.component.scss']
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

