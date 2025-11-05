import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WatchlistItem } from '../models/stock.model';

@Injectable({
  providedIn: 'root'
})
export class WatchlistService {
  private watchlistKey = 'stock_analyzer_watchlist';
  private watchlistSubject = new BehaviorSubject<WatchlistItem[]>(this.loadWatchlist());
  public watchlist$ = this.watchlistSubject.asObservable();

  constructor() {}

  /**
   * Get all watchlist items
   */
  getWatchlist(): Observable<WatchlistItem[]> {
    return this.watchlist$;
  }

  /**
   * Add stock to watchlist
   */
  addToWatchlist(symbol: string, notes?: string): void {
    const watchlist = this.watchlistSubject.value;
    
    // Check if already exists
    if (watchlist.some(item => item.symbol === symbol)) {
      return;
    }

    const newItem: WatchlistItem = {
      id: this.generateId(),
      symbol: symbol,
      addedDate: new Date(),
      notes: notes
    };

    const updatedWatchlist = [...watchlist, newItem];
    this.saveWatchlist(updatedWatchlist);
    this.watchlistSubject.next(updatedWatchlist);
  }

  /**
   * Remove stock from watchlist
   */
  removeFromWatchlist(symbol: string): void {
    const watchlist = this.watchlistSubject.value.filter(item => item.symbol !== symbol);
    this.saveWatchlist(watchlist);
    this.watchlistSubject.next(watchlist);
  }

  /**
   * Check if symbol is in watchlist
   */
  isInWatchlist(symbol: string): boolean {
    return this.watchlistSubject.value.some(item => item.symbol === symbol);
  }

  /**
   * Update watchlist item notes
   */
  updateNotes(symbol: string, notes: string): void {
    const watchlist = this.watchlistSubject.value.map(item =>
      item.symbol === symbol ? { ...item, notes } : item
    );
    this.saveWatchlist(watchlist);
    this.watchlistSubject.next(watchlist);
  }

  /**
   * Load watchlist from localStorage
   */
  private loadWatchlist(): WatchlistItem[] {
    try {
      const stored = localStorage.getItem(this.watchlistKey);
      if (stored) {
        const items = JSON.parse(stored);
        // Convert date strings back to Date objects
        return items.map((item: any) => ({
          ...item,
          addedDate: new Date(item.addedDate)
        }));
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
    }
    return [];
  }

  /**
   * Save watchlist to localStorage
   */
  private saveWatchlist(watchlist: WatchlistItem[]): void {
    try {
      localStorage.setItem(this.watchlistKey, JSON.stringify(watchlist));
    } catch (error) {
      console.error('Error saving watchlist:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

