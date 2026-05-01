import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { WatchlistItem, Watchlist } from '../models/stock.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface WatchlistRow {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WatchlistItemRow {
  id: string;
  symbol: string;
  notes?: string;
  addedDate: string;
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
  public watchlist$: Observable<WatchlistItem[]> = this.watchlistItems$;
  private apiUrl = environment.api.baseUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.loadWatchlistsFromCache(user.id);
        this.loadWatchlists().then(() => this.loadSelectedWatchlistItems());
      } else {
        this.watchlistsSubject.next([]);
        this.selectedWatchlistIdSubject.next(null);
        this.watchlistItemsSubject.next([]);
        this.clearWatchlistCache();
      }
    });
  }

  getWatchlists(): Observable<Watchlist[]> {
    return this.watchlists$;
  }

  getWatchlist(): Observable<WatchlistItem[]> {
    return this.watchlist$;
  }

  async createWatchlist(name: string, description?: string, isDefault: boolean = false): Promise<Watchlist> {
    this.requireUser();
    const response = await firstValueFrom(
      this.http.post<ApiResponse<WatchlistRow>>(`${this.apiUrl}/watchlists`, {
        name: name.trim(),
        description: description?.trim() || null,
        isDefault
      })
    );
    await this.loadWatchlists();
    if (response.data && (isDefault || this.watchlistsSubject.value.length === 1)) {
      this.selectWatchlist(response.data.id);
    }
    return this.mapWatchlistRow(response.data!);
  }

  async updateWatchlist(watchlistId: string, updates: { name?: string; description?: string; isDefault?: boolean }): Promise<void> {
    this.requireUser();
    await firstValueFrom(
      this.http.patch<ApiResponse<WatchlistRow>>(`${this.apiUrl}/watchlists/${watchlistId}`, updates)
    );
    await this.loadWatchlists();
  }

  async deleteWatchlist(watchlistId: string): Promise<void> {
    this.requireUser();
    await firstValueFrom(
      this.http.delete<ApiResponse<void>>(`${this.apiUrl}/watchlists/${watchlistId}`)
    );
    if (this.selectedWatchlistIdSubject.value === watchlistId) {
      this.selectedWatchlistIdSubject.next(null);
      this.watchlistItemsSubject.next([]);
    }
    await this.loadWatchlists();
  }

  selectWatchlist(watchlistId: string | null): void {
    this.selectedWatchlistIdSubject.next(watchlistId);
    this.loadSelectedWatchlistItems();
  }

  async addToWatchlist(symbol: string, notes?: string, watchlistId?: string): Promise<void> {
    this.requireUser();
    const targetWatchlistId = watchlistId || this.selectedWatchlistIdSubject.value;
    if (!targetWatchlistId) {
      throw new Error('No watchlist selected. Please create or select a watchlist first.');
    }
    await firstValueFrom(
      this.http.post<ApiResponse<void>>(`${this.apiUrl}/watchlists/${targetWatchlistId}/items`, {
        symbol: symbol.toUpperCase(),
        notes: notes || null
      })
    );
    if (targetWatchlistId === this.selectedWatchlistIdSubject.value) {
      await this.loadSelectedWatchlistItems();
    }
  }

  async removeFromWatchlist(symbol: string, watchlistId?: string): Promise<void> {
    this.requireUser();
    const targetWatchlistId = watchlistId || this.selectedWatchlistIdSubject.value;
    if (!targetWatchlistId) {
      throw new Error('No watchlist selected');
    }
    await firstValueFrom(
      this.http.delete<ApiResponse<void>>(`${this.apiUrl}/watchlists/${targetWatchlistId}/items/${symbol.toUpperCase()}`)
    );
    if (targetWatchlistId === this.selectedWatchlistIdSubject.value) {
      await this.loadSelectedWatchlistItems();
    }
  }

  isInWatchlist(symbol: string): boolean {
    return this.watchlistItemsSubject.value.some(item => item.symbol.toUpperCase() === symbol.toUpperCase());
  }

  private async loadWatchlists(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.watchlistsSubject.next([]);
      return;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<WatchlistRow[]>>(`${this.apiUrl}/watchlists`)
      );
      const watchlists = (response.data || []).map(row => this.mapWatchlistRow(row));
      this.watchlistsSubject.next(watchlists);
      this.saveWatchlistsToCache(user.id, watchlists);
      if (watchlists.length === 0) {
        const defaultWatchlist = await this.createWatchlist('My Watchlist', 'Default watchlist', true);
        this.selectWatchlist(defaultWatchlist.id);
        return;
      }
      if (!this.selectedWatchlistIdSubject.value) {
        const defaultWatchlist = watchlists.find(w => w.isDefault);
        this.selectWatchlist(defaultWatchlist ? defaultWatchlist.id : watchlists[0].id);
      }
    } catch (error) {
      console.error('Error loading watchlists from API:', error);
      this.watchlistsSubject.next([]);
    }
  }

  private async loadSelectedWatchlistItems(): Promise<void> {
    const watchlistId = this.selectedWatchlistIdSubject.value;
    const user = this.authService.getCurrentUser();
    if (!watchlistId || !user) {
      this.watchlistItemsSubject.next([]);
      return;
    }
    this.loadWatchlistItemsFromCache(user.id, watchlistId);
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<WatchlistItemRow[]>>(`${this.apiUrl}/watchlists/${watchlistId}/items`)
      );
      const items = (response.data || []).map(row => ({
        id: row.id,
        symbol: row.symbol,
        notes: row.notes || undefined,
        addedDate: new Date(row.addedDate)
      }));
      this.watchlistItemsSubject.next(items);
      this.saveWatchlistItemsToCache(user.id, watchlistId, items);
    } catch (error) {
      console.error('Error loading watchlist items from API:', error);
      this.watchlistItemsSubject.next([]);
    }
  }

  private requireUser() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  }

  private getCacheKey(userId: string, type: string): string {
    return `watchlist_cache_${userId}_${type}`;
  }

  private loadWatchlistsFromCache(userId: string): void {
    const cached = localStorage.getItem(this.getCacheKey(userId, 'watchlists'));
    if (cached) {
      this.watchlistsSubject.next(JSON.parse(cached).map((w: any) => ({
        ...w,
        createdAt: new Date(w.createdAt),
        updatedAt: new Date(w.updatedAt)
      })));
    }
  }

  private saveWatchlistsToCache(userId: string, watchlists: Watchlist[]): void {
    localStorage.setItem(this.getCacheKey(userId, 'watchlists'), JSON.stringify(watchlists));
  }

  private loadWatchlistItemsFromCache(userId: string, watchlistId: string): void {
    const cached = localStorage.getItem(this.getCacheKey(userId, `items_${watchlistId}`));
    if (cached) {
      this.watchlistItemsSubject.next(JSON.parse(cached).map((item: any) => ({
        ...item,
        addedDate: new Date(item.addedDate)
      })));
    }
  }

  private saveWatchlistItemsToCache(userId: string, watchlistId: string, items: WatchlistItem[]): void {
    localStorage.setItem(this.getCacheKey(userId, `items_${watchlistId}`), JSON.stringify(items));
  }

  private clearWatchlistCache(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('watchlist_cache_')) {
        localStorage.removeItem(key);
      }
    });
  }

  private mapWatchlistRow(row: WatchlistRow): Watchlist {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      isDefault: row.isDefault,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}
