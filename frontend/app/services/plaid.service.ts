import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlaidAccount, PlaidSyncSummary } from '../models/cashflow.model';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface PlaidLinkTokenResponse {
  linkToken: string;
}

interface PlaidExchangePayload {
  publicToken: string;
  institutionId?: string | null;
  institutionName?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class PlaidService {
  private apiUrl = `${environment.api.baseUrl}/plaid`;

  constructor(private http: HttpClient) {}

  async createLinkToken(): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<PlaidLinkTokenResponse>>(`${this.apiUrl}/link-token`, {})
    );
    if (!response.data?.linkToken) {
      throw new Error(response.message || 'Unable to create Plaid Link token');
    }
    return response.data.linkToken;
  }

  async exchangePublicToken(payload: PlaidExchangePayload): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/exchange-public-token`, payload));
  }

  async sync(auto = false): Promise<PlaidSyncSummary> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<PlaidSyncSummary>>(`${this.apiUrl}/sync`, { auto })
    );
    return response.data || { added: 0, modified: 0, removed: 0, itemsSynced: 0, skipped: false };
  }

  async getAccounts(): Promise<PlaidAccount[]> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<PlaidAccount[]>>(`${this.apiUrl}/accounts`)
    );
    return response.data || [];
  }

  async removeAccount(accountId: string): Promise<void> {
    await firstValueFrom(this.http.delete<ApiResponse<void>>(`${this.apiUrl}/accounts/${accountId}`));
  }

  async hideAccount(accountId: string): Promise<void> {
    await firstValueFrom(this.http.patch<ApiResponse<void>>(`${this.apiUrl}/accounts/${accountId}/hide`, {}));
  }
}
