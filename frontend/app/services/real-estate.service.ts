import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import {
  RealEstateProperty,
  RealEstatePropertyInputs,
  RealEstatePropertyRow,
  RealEstateSearchParams,
  RealEstateSearchResult,
  RentcastUsage
} from '../models/real-estate.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export type RealEstatePropertyCreate = RealEstatePropertyInputs & {
  monthlyCashFlow: number;
  capRate: number;
  cashOnCashReturn: number;
};

@Injectable({
  providedIn: 'root'
})
export class RealEstateService {
  private propertiesSubject = new BehaviorSubject<RealEstateProperty[]>([]);
  public properties$ = this.propertiesSubject.asObservable();
  private apiUrl = environment.api.baseUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.loadProperties();
      } else {
        this.propertiesSubject.next([]);
      }
    });
  }

  getCurrentProperties(): RealEstateProperty[] {
    return this.propertiesSubject.value;
  }

  async refreshProperties(): Promise<void> {
    await this.loadProperties();
  }

  async searchListings(params: RealEstateSearchParams): Promise<RealEstateSearchResult> {
    let httpParams = new HttpParams();
    if (params.location) {
      httpParams = httpParams.set('location', params.location);
    }
    if (params.minPrice != null) {
      httpParams = httpParams.set('minPrice', params.minPrice);
    }
    if (params.maxPrice != null) {
      httpParams = httpParams.set('maxPrice', params.maxPrice);
    }
    if (params.propertyType) {
      httpParams = httpParams.set('propertyType', params.propertyType);
    }
    if (params.minBedrooms != null) {
      httpParams = httpParams.set('minBedrooms', params.minBedrooms);
    }
    if (params.refresh) {
      httpParams = httpParams.set('refresh', 'true');
    }
    const response = await firstValueFrom(
      this.http.get<ApiResponse<RealEstateSearchResult>>(`${this.apiUrl}/real-estate/search`, { params: httpParams })
    );
    return response.data || { listings: [], source: 'sample' };
  }

  async getUsage(): Promise<RentcastUsage | null> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<RentcastUsage>>(`${this.apiUrl}/real-estate/usage`)
    );
    return response.data || null;
  }

  async createProperty(property: RealEstatePropertyCreate): Promise<RealEstateProperty> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<RealEstatePropertyRow>>(`${this.apiUrl}/real-estate/properties`, property)
    );
    await this.loadProperties();
    return this.mapPropertyRow(response.data!);
  }

  async updateProperty(propertyId: string, updates: Partial<RealEstatePropertyCreate>): Promise<void> {
    await firstValueFrom(
      this.http.patch<ApiResponse<RealEstatePropertyRow>>(`${this.apiUrl}/real-estate/properties/${propertyId}`, updates)
    );
    await this.loadProperties();
  }

  async deleteProperty(propertyId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<ApiResponse<void>>(`${this.apiUrl}/real-estate/properties/${propertyId}`)
    );
    await this.loadProperties();
  }

  private async loadProperties(): Promise<void> {
    if (!this.authService.getCurrentUser()) {
      this.propertiesSubject.next([]);
      return;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<RealEstatePropertyRow[]>>(`${this.apiUrl}/real-estate/properties`)
      );
      this.propertiesSubject.next((response.data || []).map(row => this.mapPropertyRow(row)));
    } catch (error) {
      console.error('Error loading real estate properties:', error);
      this.propertiesSubject.next([]);
    }
  }

  private mapPropertyRow(row: RealEstatePropertyRow): RealEstateProperty {
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}
