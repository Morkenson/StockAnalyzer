import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  Portfolio,
  RecurringInvestment
} from '../models/snaptrade.model';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SnapTradeService {
  private apiUrl = `${environment.api.baseUrl}/snaptrade`;

  constructor(private http: HttpClient) {}

  /**
   * Initiate brokerage connection
   * Returns redirect URI for OAuth flow
   */
  initiateConnection(): Observable<{ redirectUri: string }> {
    return this.http.post<ApiResponse<{ redirectUri: string }>>(`${this.apiUrl}/connect/initiate`, {})
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return { redirectUri: response.data.redirectUri };
          }
          throw new Error(response.message || 'Failed to initiate connection');
        }),
        catchError(error => {
          console.error('Error initiating connection:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get portfolio for the authenticated user
   */
  getPortfolio(refresh = false): Observable<Portfolio> {
    return this.http.get<ApiResponse<Portfolio>>(`${this.apiUrl}/portfolio`, {
      params: refresh ? { refresh: 'true' } : {}
    })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load portfolio');
        }),
        catchError(error => {
          console.error('Error fetching portfolio:', error);
          return throwError(() => error);
        })
      );
  }

  getRecurringInvestments(refresh = false): Observable<RecurringInvestment[]> {
    return this.http.get<ApiResponse<RecurringInvestment[]>>(`${this.apiUrl}/recurring-investments`, {
      params: refresh ? { refresh: 'true' } : {}
    })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load recurring investments');
        }),
        catchError(error => {
          console.error('Error fetching recurring investments:', error);
          return throwError(() => error);
        })
      );
  }

  updateAccountPreference(accountId: string, preference: { nickname?: string | null; hidden?: boolean }): Observable<{ accountId: string; nickname?: string | null; hidden: boolean }> {
    return this.http.patch<ApiResponse<{ accountId: string; nickname?: string | null; hidden: boolean }>>(`${this.apiUrl}/accounts/${accountId}/preference`, preference)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to update account');
        }),
        catchError(error => {
          console.error('Error updating account preference:', error);
          return throwError(() => error);
        })
      );
  }

  hideAccount(accountId: string): Observable<{ accountId: string; hidden: boolean }> {
    return this.http.delete<ApiResponse<{ accountId: string; hidden: boolean }>>(`${this.apiUrl}/accounts/${accountId}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to remove account');
        }),
        catchError(error => {
          console.error('Error removing account:', error);
          return throwError(() => error);
        })
      );
  }

}
