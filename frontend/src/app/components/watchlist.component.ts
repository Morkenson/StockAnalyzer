import { Component, OnInit, OnDestroy } from '@angular/core';
import { StockService } from '../services/stock.service';
import { WatchlistService } from '../services/watchlist.service';
import { WatchlistItem, StockQuote, Watchlist } from '../models/stock.model';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-watchlist',
  template: `
    <div class="watchlist">
      <div class="watchlist-header">
        <div class="header-left">
          <div class="watchlist-selector-wrapper">
            <h1>Watchlists</h1>
            <div class="watchlist-controls">
              <select 
                class="watchlist-select"
                [value]="selectedWatchlistId || ''"
                (change)="onWatchlistChange($event)"
                *ngIf="watchlists.length > 0">
                <option *ngFor="let wl of watchlists" [value]="wl.id">
                  {{ wl.name }}{{ wl.isDefault ? ' (Default)' : '' }}
                </option>
              </select>
              <button 
                class="btn btn-secondary btn-sm"
                (click)="showCreateModal = true"
                title="Create new watchlist">
                + New
              </button>
              <button 
                *ngIf="selectedWatchlist"
                class="btn btn-secondary btn-sm"
                (click)="openEditModal()"
                title="Edit watchlist">
                Edit
              </button>
              <button 
                *ngIf="selectedWatchlist && !selectedWatchlist.isDefault"
                class="btn btn-secondary btn-sm btn-danger"
                (click)="deleteWatchlist()"
                title="Delete watchlist">
                Delete
              </button>
            </div>
          </div>
          <p class="watchlist-subtitle" *ngIf="selectedWatchlist && watchlistItems.length > 0">
            {{ selectedWatchlist.name }} • Tracking {{ watchlistItems.length }} {{ watchlistItems.length === 1 ? 'stock' : 'stocks' }}
          </p>
        </div>
        <button 
          *ngIf="selectedWatchlist && watchlistItems.length > 0" 
          class="btn btn-primary"
          routerLink="/search">
          + Add Stocks
        </button>
      </div>
      
      <!-- Create Watchlist Modal -->
      <div class="modal-overlay" *ngIf="showCreateModal" (click)="showCreateModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Create New Watchlist</h2>
            <button class="modal-close" (click)="showCreateModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Name *</label>
              <input type="text" [(ngModel)]="newWatchlistName" placeholder="e.g., Tech Stocks" class="form-control">
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea [(ngModel)]="newWatchlistDescription" placeholder="Optional description" class="form-control" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" [(ngModel)]="newWatchlistIsDefault">
                Set as default watchlist
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showCreateModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="createWatchlist()" [disabled]="!newWatchlistName?.trim()">Create</button>
          </div>
        </div>
      </div>
      
      <!-- Edit Watchlist Modal -->
      <div class="modal-overlay" *ngIf="showEditModal && selectedWatchlist" (click)="showEditModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Edit Watchlist</h2>
            <button class="modal-close" (click)="showEditModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Name *</label>
              <input type="text" [(ngModel)]="editWatchlistName" placeholder="Watchlist name" class="form-control">
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea [(ngModel)]="editWatchlistDescription" placeholder="Optional description" class="form-control" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" [(ngModel)]="editWatchlistIsDefault">
                Set as default watchlist
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showEditModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="updateWatchlist()" [disabled]="!editWatchlistName?.trim()">Save</button>
          </div>
        </div>
      </div>
      
      <!-- Empty state when no watchlists exist -->
      <div class="card" *ngIf="watchlists.length === 0 && !loading">
        <div class="empty-state">
          <div class="empty-state-icon">⭐</div>
          <h3>No watchlists yet</h3>
          <p>Create your first watchlist to start tracking stocks</p>
          <button class="btn btn-primary" (click)="showCreateModal = true">Create Watchlist</button>
        </div>
      </div>
      
      <div class="card" *ngIf="selectedWatchlist && watchlistItems.length === 0">
        <div class="empty-state">
          <div class="empty-state-icon">⭐</div>
          <h3>{{ selectedWatchlist.name }} is empty</h3>
          <p>Search for stocks and add them to this watchlist to track them here</p>
          <button class="btn btn-primary" routerLink="/search">Search Stocks</button>
        </div>
      </div>

      <div *ngIf="selectedWatchlist && watchlistItems.length > 0" class="card watchlist-card">
        <div class="card-header">
          <span>Watchlist</span>
          <span class="card-badge">{{ watchlistItems.length }}</span>
        </div>
        
        <div *ngIf="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading watchlist data...</p>
        </div>
        
        <div *ngIf="!loading && stockQuotes.length > 0" class="table-wrapper">
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
              <tr *ngFor="let quote of stockQuotes; let i = index" 
                  class="watchlist-row" 
                  (click)="viewStock(quote.symbol)"
                  [attr.aria-label]="'View details for ' + quote.symbol">
                <td>
                  <strong>{{ quote.symbol }}</strong>
                </td>
                <td class="price-cell">
                  <span class="price-value">{{ '$' + (quote.price | number:'1.2-2') }}</span>
                </td>
                <td>
                  <span class="change-value" [class.positive]="quote.change >= 0" [class.negative]="quote.change < 0">
                    {{ quote.change >= 0 ? '+' : '' }}{{ quote.change | number:'1.2-2' }}
                  </span>
                </td>
                <td>
                  <span class="change-percent" [class.positive]="quote.changePercent >= 0" [class.negative]="quote.changePercent < 0">
                    {{ quote.changePercent >= 0 ? '+' : '' }}{{ quote.changePercent | number:'1.2-2' }}%
                  </span>
                </td>
                <td class="volume-cell">{{ quote.volume | number }}</td>
                <td class="date-cell">{{ getAddedDate(quote.symbol) | date:'MMM d, y' }}</td>
                <td class="actions-cell" (click)="$event.stopPropagation()">
                  <button 
                    class="btn btn-secondary btn-sm" 
                    (click)="removeFromWatchlist(quote.symbol)"
                    [attr.aria-label]="'Remove ' + quote.symbol + ' from watchlist'">
                    Remove
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="!loading && stockQuotes.length === 0 && watchlistItems.length > 0" class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <p>{{ errorMessage || 'Unable to load stock data. Please try refreshing.' }}</p>
          <button class="btn btn-primary" (click)="loadWatchlist()">Retry</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .watchlist {
      padding: var(--spacing-xl) 0;
    }

    .watchlist-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-2xl);
      gap: var(--spacing-lg);
    }

    .watchlist-header h1 {
      margin-bottom: var(--spacing-sm);
    }

    .watchlist-subtitle {
      font-size: var(--font-size-lg);
      color: var(--color-text-secondary);
      margin-bottom: 0;
    }

    .watchlist-card {
      margin-bottom: var(--spacing-lg);
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-2xl) 0;
    }

    .loading-state p {
      color: var(--color-text-secondary);
      margin: 0;
    }

    .table-wrapper {
      overflow-x: auto;
      margin-top: var(--spacing-md);
    }

    .watchlist-row {
      transition: background-color var(--transition-fast);
      cursor: pointer;
    }

    .watchlist-row:hover {
      background-color: var(--color-bg-tertiary);
    }

    .watchlist-row td:first-child strong {
      color: var(--color-primary);
      font-weight: var(--font-weight-semibold);
      transition: color var(--transition-base);
    }

    .watchlist-row:hover td:first-child strong {
      color: var(--color-primary-dark);
    }

    .price-cell {
      font-weight: var(--font-weight-semibold);
    }

    .price-value {
      color: var(--color-text-primary);
      font-size: var(--font-size-base);
    }

    .change-value,
    .change-percent {
      font-weight: var(--font-weight-medium);
      font-size: var(--font-size-sm);
    }

    .volume-cell {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .date-cell {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .actions-cell {
      white-space: nowrap;
    }

    .actions-cell button {
      cursor: pointer;
    }

    .action-buttons {
      display: flex;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
    }

    .header-left {
      flex: 1;
    }

    .watchlist-selector-wrapper {
      margin-bottom: var(--spacing-sm);
    }

    .watchlist-controls {
      display: flex;
      gap: var(--spacing-sm);
      align-items: center;
      margin-top: var(--spacing-sm);
      flex-wrap: wrap;
    }

    .watchlist-select {
      padding: var(--spacing-sm) var(--spacing-md);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg-primary);
      color: var(--color-text-primary);
      font-size: var(--font-size-base);
      font-family: var(--font-family);
      cursor: pointer;
      min-width: 200px;
    }

    .watchlist-select:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }

    .btn-danger {
      background-color: var(--color-danger, #ef4444);
      color: white;
      border-color: var(--color-danger, #ef4444);
    }

    .btn-danger:hover {
      background-color: var(--color-danger-dark, #dc2626);
      border-color: var(--color-danger-dark, #dc2626);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: var(--spacing-lg);
    }

    .modal-content {
      background: var(--color-bg-primary);
      border-radius: var(--radius-lg);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--color-border);
    }

    .modal-header h2 {
      margin: 0;
      font-size: var(--font-size-xl);
    }

    .modal-close {
      background: none;
      border: none;
      font-size: var(--font-size-2xl);
      color: var(--color-text-secondary);
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      transition: background-color var(--transition-base);
    }

    .modal-close:hover {
      background: var(--color-bg-tertiary);
    }

    .modal-body {
      padding: var(--spacing-lg);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-md);
      padding: var(--spacing-lg);
      border-top: 1px solid var(--color-border);
    }

    .form-group {
      margin-bottom: var(--spacing-lg);
    }

    .form-group label {
      display: block;
      margin-bottom: var(--spacing-xs);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }

    .form-control {
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg-primary);
      color: var(--color-text-primary);
      font-size: var(--font-size-base);
      font-family: var(--font-family);
    }

    .form-control:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }

    .form-group input[type="checkbox"] {
      margin-right: var(--spacing-xs);
    }

    @media (max-width: 768px) {
      .watchlist {
        padding: var(--spacing-lg) 0;
      }

      .watchlist-header {
        flex-direction: column;
        margin-bottom: var(--spacing-xl);
      }

      .watchlist-subtitle {
        font-size: var(--font-size-base);
      }

      .table-wrapper {
        font-size: var(--font-size-xs);
      }

      .action-buttons {
        flex-direction: column;
      }

      .action-buttons .btn {
        width: 100%;
      }
    }
  `]
})
export class WatchlistComponent implements OnInit, OnDestroy {
  watchlists: Watchlist[] = [];
  selectedWatchlist: Watchlist | null = null;
  selectedWatchlistId: string | null = null;
  watchlistItems: WatchlistItem[] = [];
  stockQuotes: StockQuote[] = [];
  loading = false;
  errorMessage: string | null = null;
  
  // Modal states
  showCreateModal = false;
  showEditModal = false;
  newWatchlistName = '';
  newWatchlistDescription = '';
  newWatchlistIsDefault = false;
  editWatchlistName = '';
  editWatchlistDescription = '';
  editWatchlistIsDefault = false;
  
  private subscriptions = new Subscription();

  constructor(
    private watchlistService: WatchlistService,
    private stockService: StockService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to watchlists
    this.subscriptions.add(
      this.watchlistService.getWatchlists().subscribe(watchlists => {
        this.watchlists = watchlists;
        // Update selected watchlist reference when watchlists change
        if (this.selectedWatchlistId) {
          this.selectedWatchlist = this.watchlists.find(w => w.id === this.selectedWatchlistId) || null;
        }
      })
    );
    
    // Subscribe to selected watchlist ID
    this.subscriptions.add(
      this.watchlistService.selectedWatchlistId$.subscribe(id => {
        this.selectedWatchlistId = id;
        this.selectedWatchlist = this.watchlists.find(w => w.id === id) || null;
      })
    );
    
    // Load watchlist items when selected watchlist changes
    this.subscriptions.add(
      this.watchlistService.selectedWatchlistId$.subscribe(() => {
        this.loadWatchlist();
      })
    );
  }
  
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
  
  onWatchlistChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const watchlistId = selectElement.value;
    if (watchlistId) {
      this.watchlistService.selectWatchlist(watchlistId);
      this.loadWatchlist();
    }
  }
  
  async createWatchlist(): Promise<void> {
    if (!this.newWatchlistName?.trim()) {
      return;
    }
    
    try {
      await this.watchlistService.createWatchlist(
        this.newWatchlistName.trim(),
        this.newWatchlistDescription.trim() || undefined,
        this.newWatchlistIsDefault
      );
      this.showCreateModal = false;
      this.newWatchlistName = '';
      this.newWatchlistDescription = '';
      this.newWatchlistIsDefault = false;
      this.loadWatchlist();
    } catch (error) {
      console.error('Error creating watchlist:', error);
      this.errorMessage = 'Failed to create watchlist. Please try again.';
    }
  }
  
  async updateWatchlist(): Promise<void> {
    if (!this.selectedWatchlist || !this.editWatchlistName?.trim()) {
      return;
    }
    
    try {
      await this.watchlistService.updateWatchlist(this.selectedWatchlist.id, {
        name: this.editWatchlistName.trim(),
        description: this.editWatchlistDescription.trim() || undefined,
        isDefault: this.editWatchlistIsDefault
      });
      this.showEditModal = false;
      this.loadWatchlist();
    } catch (error) {
      console.error('Error updating watchlist:', error);
      this.errorMessage = 'Failed to update watchlist. Please try again.';
    }
  }
  
  async deleteWatchlist(): Promise<void> {
    if (!this.selectedWatchlist || this.selectedWatchlist.isDefault) {
      return;
    }
    
    if (!confirm(`Are you sure you want to delete "${this.selectedWatchlist.name}"? This will also remove all stocks in this watchlist.`)) {
      return;
    }
    
    try {
      await this.watchlistService.deleteWatchlist(this.selectedWatchlist.id);
      this.loadWatchlist();
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      this.errorMessage = 'Failed to delete watchlist. Please try again.';
    }
  }
  
  openEditModal(): void {
    if (this.selectedWatchlist) {
      this.editWatchlistName = this.selectedWatchlist.name;
      this.editWatchlistDescription = this.selectedWatchlist.description || '';
      this.editWatchlistIsDefault = this.selectedWatchlist.isDefault;
      this.showEditModal = true;
    }
  }

  loadWatchlist(): void {
    this.loading = true;
    this.errorMessage = null;
    this.watchlistService.getWatchlist().subscribe({
      next: (items) => {
        this.watchlistItems = items;
        console.log('Watchlist items loaded:', items);
        
        if (items.length > 0) {
          const symbols = items.map(item => item.symbol.toUpperCase());
          console.log('Fetching quotes for symbols:', symbols);
          
          this.stockService.getMultipleQuotes(symbols).subscribe({
            next: (quotes) => {
              console.log('Quotes received:', quotes);
              // Sort quotes to match watchlist order
              // Note: Don't filter by price > 0 as some stocks might legitimately have price 0
              // Instead, just check if the quote exists
              this.stockQuotes = symbols
                .map(symbol => quotes.find(q => q.symbol.toUpperCase() === symbol))
                .filter((q): q is StockQuote => q !== undefined);
              
              console.log('Processed quotes:', this.stockQuotes);
              
              if (this.stockQuotes.length === 0 && symbols.length > 0) {
                this.errorMessage = 'Unable to fetch stock data. Please check your connection and try again.';
              }
              
              this.loading = false;
            },
            error: (error) => {
              console.error('Error loading stock quotes:', error);
              this.errorMessage = 'Error loading stock data. Please try refreshing the page.';
              this.stockQuotes = [];
              this.loading = false;
            }
          });
        } else {
          this.stockQuotes = [];
          this.loading = false;
        }
      },
      error: (error) => {
        console.error('Error loading watchlist:', error);
        this.errorMessage = 'Error loading watchlist. Please try refreshing the page.';
        this.watchlistItems = [];
        this.stockQuotes = [];
        this.loading = false;
      }
    });
  }

  viewStock(symbol: string): void {
    this.router.navigate(['/stock', symbol]);
  }

  async removeFromWatchlist(symbol: string): Promise<void> {
    try {
      await this.watchlistService.removeFromWatchlist(symbol);
      // Watchlist will be updated automatically via subscription, but reload to ensure consistency
      this.loadWatchlist();
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  }

  getAddedDate(symbol: string): Date {
    const item = this.watchlistItems.find(i => i.symbol === symbol);
    return item ? item.addedDate : new Date();
  }
}

