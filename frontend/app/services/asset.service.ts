import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Asset, AssetRow } from '../models/asset.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  private assetsSubject = new BehaviorSubject<Asset[]>([]);
  public assets$: Observable<Asset[]> = this.assetsSubject.asObservable();
  private apiUrl = environment.api.baseUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.loadAssetsFromCache(user.id);
        this.loadAssets();
      } else {
        this.assetsSubject.next([]);
        this.clearAssetCache();
      }
    });
  }

  getAssets(): Observable<Asset[]> {
    return this.assets$;
  }

  getCurrentAssets(): Asset[] {
    return this.assetsSubject.value;
  }

  async refreshAssets(): Promise<void> {
    await this.loadAssets();
  }

  async createAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    this.requireUser();
    const response = await firstValueFrom(
      this.http.post<ApiResponse<AssetRow>>(`${this.apiUrl}/assets`, {
        name: asset.name.trim(),
        assetType: asset.assetType,
        value: asset.value,
        institution: asset.institution?.trim() || null,
        notes: asset.notes?.trim() || null
      })
    );
    await this.loadAssets();
    return this.mapAssetRow(response.data!);
  }

  async updateAsset(assetId: string, updates: Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    this.requireUser();
    await firstValueFrom(
      this.http.patch<ApiResponse<AssetRow>>(`${this.apiUrl}/assets/${assetId}`, updates)
    );
    await this.loadAssets();
  }

  async deleteAsset(assetId: string): Promise<void> {
    this.requireUser();
    await firstValueFrom(
      this.http.delete<ApiResponse<void>>(`${this.apiUrl}/assets/${assetId}`)
    );
    await this.loadAssets();
  }

  private async loadAssets(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.assetsSubject.next([]);
      return;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<AssetRow[]>>(`${this.apiUrl}/assets`)
      );
      const assets = (response.data || []).map(row => this.mapAssetRow(row));
      this.assetsSubject.next(assets);
      this.saveAssetsToCache(user.id, assets);
    } catch (error) {
      console.error('Error loading assets from API:', error);
      this.assetsSubject.next([]);
    }
  }

  private requireUser() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  }

  private getCacheKey(userId: string): string {
    return `assets_cache_${userId}`;
  }

  private loadAssetsFromCache(userId: string): void {
    try {
      const cached = localStorage.getItem(this.getCacheKey(userId));
      if (cached) {
        this.assetsSubject.next(JSON.parse(cached).map((asset: any) => ({
          ...asset,
          createdAt: new Date(asset.createdAt),
          updatedAt: new Date(asset.updatedAt)
        })));
      }
    } catch {
      localStorage.removeItem(this.getCacheKey(userId));
    }
  }

  private saveAssetsToCache(userId: string, assets: Asset[]): void {
    localStorage.setItem(this.getCacheKey(userId), JSON.stringify(assets));
  }

  private clearAssetCache(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('assets_cache_')) {
        localStorage.removeItem(key);
      }
    });
  }

  private mapAssetRow(row: AssetRow): Asset {
    return {
      id: row.id,
      name: row.name,
      assetType: row.assetType,
      value: row.value,
      institution: row.institution || undefined,
      notes: row.notes || undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}
