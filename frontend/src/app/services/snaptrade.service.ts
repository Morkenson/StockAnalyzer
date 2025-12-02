import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  SnapTradeUser,
  Brokerage,
  BrokerageConnection,
  Account,
  Portfolio,
  TradeOrder,
  TradeExecution,
  AccountBalance,
  Holding
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
   * Create a new SnapTrade user
   * Backend handles the actual SnapTrade API call
   */
  createUser(): Observable<{ success: boolean; message: string }> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      // TODO: Add authentication header when auth is implemented
      // 'Authorization': `Bearer ${this.getAuthToken()}`
    });

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/user`, {}, { headers })
      .pipe(
        map(response => ({
          success: response.success,
          message: response.message || 'User created successfully'
        })),
        catchError(error => {
          console.error('Error creating SnapTrade user:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Initiate brokerage connection
   * Returns redirect URI for OAuth flow
   */
  initiateConnection(): Observable<{ redirectUri: string }> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.post<ApiResponse<{ redirectUri: string }>>(`${this.apiUrl}/connect/initiate`, {}, { headers })
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
    const headers = new HttpHeaders({
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.get<ApiResponse<Portfolio>>(`${this.apiUrl}/portfolio`, { headers })
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

  /**
   * Get all accounts for the authenticated user
   */
  getAccounts(): Observable<Account[]> {
    const headers = new HttpHeaders({
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.get<ApiResponse<Account[]>>(`${this.apiUrl}/accounts`, { headers })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load accounts');
        }),
        catchError(error => {
          console.error('Error fetching accounts:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get account details
   */
  getAccount(accountId: string): Observable<Account> {
    const headers = new HttpHeaders({
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.get<ApiResponse<Account>>(`${this.apiUrl}/accounts/${accountId}`, { headers })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load account');
        }),
        catchError(error => {
          console.error('Error fetching account:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get account balance
   */
  getAccountBalance(accountId: string): Observable<AccountBalance> {
    const headers = new HttpHeaders({
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.get<ApiResponse<AccountBalance>>(`${this.apiUrl}/accounts/${accountId}/balance`, { headers })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load account balance');
        }),
        catchError(error => {
          console.error('Error fetching account balance:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get holdings for a specific account
   */
  getAccountHoldings(accountId: string): Observable<Holding[]> {
    const headers = new HttpHeaders({
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.get<ApiResponse<Holding[]>>(`${this.apiUrl}/accounts/${accountId}/holdings`, { headers })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load holdings');
        }),
        catchError(error => {
          console.error('Error fetching holdings:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get list of available brokerages
   */
  getBrokerages(): Observable<Brokerage[]> {
    const headers = new HttpHeaders({
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.get<ApiResponse<Brokerage[]>>(`${this.apiUrl}/brokerages`, { headers })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load brokerages');
        }),
        catchError(error => {
          console.error('Error fetching brokerages:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Place a trade order
   */
  placeTrade(accountId: string, order: TradeOrder): Observable<TradeExecution> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.post<ApiResponse<TradeExecution>>(`${this.apiUrl}/trade/${accountId}`, order, { headers })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to place trade');
        }),
        catchError(error => {
          console.error('Error placing trade:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get trade execution status
   */
  getTradeStatus(accountId: string, tradeId: string): Observable<TradeExecution> {
    const headers = new HttpHeaders({
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.get<ApiResponse<TradeExecution>>(`${this.apiUrl}/trade/${accountId}/${tradeId}`, { headers })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to get trade status');
        }),
        catchError(error => {
          console.error('Error fetching trade status:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Cancel a pending trade
   */
  cancelTrade(accountId: string, tradeId: string): Observable<void> {
    const headers = new HttpHeaders({
      // TODO: Add authentication header when auth is implemented
    });

    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/trade/${accountId}/${tradeId}`, { headers })
      .pipe(
        map(() => void 0),
        catchError(error => {
          console.error('Error cancelling trade:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get trade history for an account
   */
  getTradeHistory(accountId: string, startDate?: Date, endDate?: Date): Observable<TradeExecution[]> {
    const headers = new HttpHeaders({
      // TODO: Add authentication header when auth is implemented
    });

    let url = `${this.apiUrl}/accounts/${accountId}/trades`;
    if (startDate || endDate) {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      url += `?${params.toString()}`;
    }

    return this.http.get<ApiResponse<TradeExecution[]>>(url, { headers })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load trade history');
        }),
        catchError(error => {
          console.error('Error fetching trade history:', error);
          return throwError(() => error);
        })
      );
  }
}
