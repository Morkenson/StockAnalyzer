import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { TaxCalculationResult, TaxProfile, TaxProfileInputs } from '../models/taxes.model';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TaxesService {
  private apiUrl = `${environment.api.baseUrl}/taxes`;

  constructor(private http: HttpClient) {}

  async getProfile(): Promise<TaxProfile | null> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<TaxProfile | null>>(`${this.apiUrl}/profile`)
    );
    return response.data || null;
  }

  async saveProfile(profile: TaxProfileInputs): Promise<TaxProfile> {
    const response = await firstValueFrom(
      this.http.put<ApiResponse<TaxProfile>>(`${this.apiUrl}/profile`, profile)
    );
    if (!response.data) {
      throw new Error(response.message || 'Unable to save tax profile');
    }
    return response.data;
  }

  async calculate(inputs: TaxProfileInputs): Promise<TaxCalculationResult> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<TaxCalculationResult>>(`${this.apiUrl}/calculate`, inputs)
    );
    if (!response.data) {
      throw new Error(response.message || 'Unable to calculate taxes');
    }
    return response.data;
  }
}
