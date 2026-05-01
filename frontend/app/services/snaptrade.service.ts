import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  Portfolio
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
  getPortfolio(): Observable<Portfolio> {
    return this.http.get<ApiResponse<Portfolio>>(`${this.apiUrl}/portfolio`)
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

}
