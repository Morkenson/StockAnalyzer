import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WatchlistItem, Watchlist } from '../models/stock.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

interface WatchlistRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface WatchlistItemRow {
  id: string;
  watchlist_id: string;
  symbol: string;
  notes?: string;
  added_date: string;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class WatchlistService {
  private watchlistsSubject = new BehaviorSubject<Watchlist[]>([]);
  public watchlists$ = this.watchlistsSubject.asObservable();
  
  private selectedWatchlistIdSubject = new BehaviorSubject<string | null>(null);
  public selectedWatchlistId$ = this.selectedWatchlistIdSubject.asObservable();
  
  private watchlistItemsSubject = new BehaviorSubject<WatchlistItem[]>([]);
  public watchlistItems$ = this.watchlistItemsSubject.asObservable();
  
  // Combined observable that emits current watchlist items
  public watchlist$: Observable<WatchlistItem[]> = this.watchlistItems$;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {
    // Load watchlists when user logs in
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        // Try to load from cache first for instant display
        this.loadWatchlistsFromCache(user.id);
        
        // Then load from server to ensure we have the latest data
        this.loadWatchlists().then(() => {
          this.loadSelectedWatchlistItems();
        });
      } else {
        this.watchlistsSubject.next([]);
        this.selectedWatchlistIdSubject.next(null);
        this.watchlistItemsSubject.next([]);
        this.clearWatchlistCache();
      }
    });
  }

  /**
   * Get all watchlists
   */
  getWatchlists(): Observable<Watchlist[]> {
    return this.watchlists$;
  }

  /**
   * Get current selected watchlist items
   */
  getWatchlist(): Observable<WatchlistItem[]> {
    return this.watchlist$;
  }

  /**
   * Create a new watchlist
   */
  async createWatchlist(name: string, description?: string, isDefault: boolean = false): Promise<Watchlist> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('watchlists')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description?.trim() || null,
          is_default: isDefault
        })
        .select()
        .single();

      if (error) throw error;

      await this.loadWatchlists(); // This will update the cache
      
      // If this is the default or first watchlist, select it
      if (isDefault || this.watchlistsSubject.value.length === 1) {
        this.selectWatchlist(data.id);
      }

      return this.mapWatchlistRow(data);
    } catch (error) {
      console.error('Error creating watchlist:', error);
      throw error;
    }
  }

  /**
   * Update a watchlist
   */
  async updateWatchlist(watchlistId: string, updates: { name?: string; description?: string; isDefault?: boolean }): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.description !== undefined) updateData.description = updates.description?.trim() || null;
      if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault;

      const { error } = await this.supabaseService.client
        .from('watchlists')
        .update(updateData)
        .eq('id', watchlistId)
        .eq('user_id', user.id);

      if (error) throw error;

      await this.loadWatchlists();
    } catch (error) {
      console.error('Error updating watchlist:', error);
      throw error;
    }
  }

  /**
   * Delete a watchlist
   */
  async deleteWatchlist(watchlistId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { error } = await this.supabaseService.client
        .from('watchlists')
        .delete()
        .eq('id', watchlistId)
        .eq('user_id', user.id);

      if (error) throw error;

      // If we deleted the selected watchlist, select another one
      if (this.selectedWatchlistIdSubject.value === watchlistId) {
        const remainingWatchlists = this.watchlistsSubject.value.filter(w => w.id !== watchlistId);
        if (remainingWatchlists.length > 0) {
          const defaultWatchlist = remainingWatchlists.find(w => w.isDefault);
          this.selectWatchlist(defaultWatchlist ? defaultWatchlist.id : remainingWatchlists[0].id);
        } else {
          this.selectedWatchlistIdSubject.next(null);
          this.watchlistItemsSubject.next([]);
        }
      }

      await this.loadWatchlists();
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      throw error;
    }
  }

  /**
   * Select a watchlist
   */
  selectWatchlist(watchlistId: string | null): void {
    this.selectedWatchlistIdSubject.next(watchlistId);
    this.loadSelectedWatchlistItems();
  }

  /**
   * Add stock to selected watchlist
   */
  async addToWatchlist(symbol: string, notes?: string, watchlistId?: string): Promise<void> {
    const targetWatchlistId = watchlistId || this.selectedWatchlistIdSubject.value;
    if (!targetWatchlistId) {
      throw new Error('No watchlist selected. Please create or select a watchlist first.');
    }

    try {
      const insertData = {
        watchlist_id: targetWatchlistId,
        symbol: symbol.toUpperCase(),
        notes: notes || null,
        added_date: new Date().toISOString()
      };

      console.log('Adding to watchlist:', insertData);

      const { data, error } = await this.supabaseService.client
        .from('watchlist_items')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });

        // Check if it's a duplicate key error (symbol already in watchlist)
        if (error.code === '23505') {
          console.warn(`Symbol ${symbol} already in watchlist`);
          return;
        }

        // Check if it's a foreign key constraint error (watchlist doesn't exist)
        if (error.code === '23503') {
          throw new Error('Watchlist not found. Please refresh the page and try again.');
        }

        throw error;
      }

      // Reload watchlist items if this is the selected watchlist
      if (targetWatchlistId === this.selectedWatchlistIdSubject.value) {
        await this.loadSelectedWatchlistItems();
      }
    } catch (error: any) {
      console.error('Error adding to watchlist:', error);
      if (error.message) {
        throw new Error(error.message);
      }
      throw new Error('Failed to add stock to watchlist. Please check your connection and try again.');
    }
  }

  /**
   * Remove stock from selected watchlist
   */
  async removeFromWatchlist(symbol: string, watchlistId?: string): Promise<void> {
    const targetWatchlistId = watchlistId || this.selectedWatchlistIdSubject.value;
    if (!targetWatchlistId) {
      throw new Error('No watchlist selected');
    }

    try {
      const { error } = await this.supabaseService.client
        .from('watchlist_items')
        .delete()
        .eq('watchlist_id', targetWatchlistId)
        .eq('symbol', symbol.toUpperCase());

      if (error) throw error;

      // Reload watchlist items if this is the selected watchlist
      if (targetWatchlistId === this.selectedWatchlistIdSubject.value) {
        await this.loadSelectedWatchlistItems();
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      throw error;
    }
  }

  /**
   * Check if symbol is in the selected watchlist
   */
  isInWatchlist(symbol: string): boolean {
    const items = this.watchlistItemsSubject.value;
    return items.some(item => item.symbol.toUpperCase() === symbol.toUpperCase());
  }

  /**
   * Get cache key for localStorage
   */
  private getCacheKey(userId: string, type: string): string {
    return `watchlist_cache_${userId}_${type}`;
  }

  /**
   * Load watchlists from localStorage cache
   */
  private loadWatchlistsFromCache(userId: string): void {
    try {
      const cacheKey = this.getCacheKey(userId, 'watchlists');
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const watchlists: Watchlist[] = JSON.parse(cached).map((w: any) => ({
          ...w,
          createdAt: new Date(w.createdAt),
          updatedAt: new Date(w.updatedAt)
        }));
        this.watchlistsSubject.next(watchlists);
      }
    } catch (error) {
      console.error('Error loading watchlists from cache:', error);
    }
  }

  /**
   * Save watchlists to localStorage cache
   */
  private saveWatchlistsToCache(userId: string, watchlists: Watchlist[]): void {
    try {
      const cacheKey = this.getCacheKey(userId, 'watchlists');
      localStorage.setItem(cacheKey, JSON.stringify(watchlists));
    } catch (error) {
      console.error('Error saving watchlists to cache:', error);
    }
  }

  /**
   * Load watchlist items from localStorage cache
   */
  private loadWatchlistItemsFromCache(userId: string, watchlistId: string): void {
    try {
      const cacheKey = this.getCacheKey(userId, `items_${watchlistId}`);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const items: WatchlistItem[] = JSON.parse(cached).map((item: any) => ({
          ...item,
          addedDate: new Date(item.addedDate)
        }));
        this.watchlistItemsSubject.next(items);
      }
    } catch (error) {
      console.error('Error loading watchlist items from cache:', error);
    }
  }

  /**
   * Save watchlist items to localStorage cache
   */
  private saveWatchlistItemsToCache(userId: string, watchlistId: string, items: WatchlistItem[]): void {
    try {
      const cacheKey = this.getCacheKey(userId, `items_${watchlistId}`);
      localStorage.setItem(cacheKey, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving watchlist items to cache:', error);
    }
  }

  /**
   * Clear watchlist cache
   */
  private clearWatchlistCache(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('watchlist_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing watchlist cache:', error);
    }
  }

  /**
   * Load all watchlists from Supabase
   */
  private async loadWatchlists(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.watchlistsSubject.next([]);
      return;
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('watchlists')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const watchlists: Watchlist[] = (data || []).map((row: WatchlistRow) => this.mapWatchlistRow(row));

      this.watchlistsSubject.next(watchlists);
      
      // Save to cache
      this.saveWatchlistsToCache(user.id, watchlists);

      // If no watchlists exist, create a default one
      if (watchlists.length === 0) {
        try {
          const defaultWatchlist = await this.createWatchlist('My Watchlist', 'Default watchlist', true);
          this.selectWatchlist(defaultWatchlist.id);
          return;
        } catch (error) {
          console.error('Error creating default watchlist:', error);
        }
      }

      // If no watchlist is selected, select the default one
      if (!this.selectedWatchlistIdSubject.value && watchlists.length > 0) {
        const defaultWatchlist = watchlists.find(w => w.isDefault);
        this.selectWatchlist(defaultWatchlist ? defaultWatchlist.id : watchlists[0].id);
      }
    } catch (error) {
      console.error('Error loading watchlists from Supabase:', error);
      this.watchlistsSubject.next([]);
    }
  }

  /**
   * Load items for the selected watchlist
   */
  private async loadSelectedWatchlistItems(): Promise<void> {
    const watchlistId = this.selectedWatchlistIdSubject.value;
    const user = this.authService.getCurrentUser();
    
    if (!watchlistId) {
      this.watchlistItemsSubject.next([]);
      return;
    }

    if (user) {
      // Try to load from cache first
      this.loadWatchlistItemsFromCache(user.id, watchlistId);
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('watchlist_items')
        .select('*')
        .eq('watchlist_id', watchlistId)
        .order('added_date', { ascending: true });

      if (error) throw error;

      const watchlistItems: WatchlistItem[] = (data || []).map((row: WatchlistItemRow) => ({
        id: row.id,
        symbol: row.symbol,
        addedDate: new Date(row.added_date),
        notes: row.notes || undefined
      }));

      this.watchlistItemsSubject.next(watchlistItems);
      
      // Save to cache
      if (user) {
        this.saveWatchlistItemsToCache(user.id, watchlistId, watchlistItems);
      }
    } catch (error) {
      console.error('Error loading watchlist items from Supabase:', error);
      this.watchlistItemsSubject.next([]);
    }
  }

  /**
   * Map database row to Watchlist interface
   */
  private mapWatchlistRow(row: WatchlistRow): Watchlist {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}