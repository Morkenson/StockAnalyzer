import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CashflowEntry, CashflowEntryCreate } from '../models/cashflow.model';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CashflowService {
  private apiUrl = `${environment.api.baseUrl}/cashflow`;

  constructor(private http: HttpClient) {}

  async getEntries(month: string): Promise<CashflowEntry[]> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<CashflowEntry[]>>(`${this.apiUrl}/entries`, { params: { month } })
    );
    return response.data || [];
  }

  async createEntry(entry: CashflowEntryCreate): Promise<CashflowEntry> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<CashflowEntry>>(`${this.apiUrl}/entries`, entry)
    );
    if (!response.data) {
      throw new Error(response.message || 'Unable to save entry');
    }
    return response.data;
  }

  async deleteEntry(entryId: string): Promise<void> {
    await firstValueFrom(this.http.delete<ApiResponse<void>>(`${this.apiUrl}/entries/${entryId}`));
  }
}
