import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  AccountBalanceSnapshot,
  DividendIncomeSummary,
  Portfolio,
  PortfolioBalanceSnapshot,
  RecurringBuySchedule,
  RecurringInvestment,
  RecurringInvestmentPreference,
  TradeExecution
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

  updateRecurringInvestmentPreference(preference: {
    accountId: string;
    symbol: string;
    currency?: string;
    amount?: number | null;
    frequency?: string | null;
    hidden?: boolean | null;
  }): Observable<RecurringInvestmentPreference> {
    return this.http.patch<ApiResponse<RecurringInvestmentPreference>>(`${this.apiUrl}/recurring-investments/preferences`, preference)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to update recurring investment');
        }),
        catchError(error => {
          console.error('Error updating recurring investment:', error);
          return throwError(() => error);
        })
      );
  }

  hideRecurringInvestmentPreference(preference: {
    accountId: string;
    symbol: string;
    currency?: string;
  }): Observable<RecurringInvestmentPreference> {
    return this.http.delete<ApiResponse<RecurringInvestmentPreference>>(`${this.apiUrl}/recurring-investments/preferences`, {
      body: preference
    })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to remove recurring investment');
        }),
        catchError(error => {
          console.error('Error removing recurring investment:', error);
          return throwError(() => error);
        })
      );
  }

  clearRecurringInvestmentPreferences(accountId: string): Observable<{ accountId: string; removed: number }> {
    return this.http.delete<ApiResponse<{ accountId: string; removed: number }>>(`${this.apiUrl}/recurring-investments/preferences/accounts/${encodeURIComponent(accountId)}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to clear recurring investment changes');
        }),
        catchError(error => {
          console.error('Error clearing recurring investment changes:', error);
          return throwError(() => error);
        })
      );
  }

  getRecurringBuys(): Observable<RecurringBuySchedule[]> {
    return this.http.get<ApiResponse<RecurringBuySchedule[]>>(`${this.apiUrl}/recurring-buys`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load recurring buys');
        }),
        catchError(error => {
          console.error('Error fetching recurring buys:', error);
          return throwError(() => error);
        })
      );
  }

  createRecurringBuy(payload: {
    accountId: string;
    symbol: string;
    units?: number;
    targetAmount?: number;
    frequency: string;
    startDate?: string;
  }): Observable<RecurringBuySchedule> {
    return this.http.post<ApiResponse<RecurringBuySchedule>>(`${this.apiUrl}/recurring-buys`, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to create recurring buy');
        }),
        catchError(error => {
          console.error('Error creating recurring buy:', error);
          return throwError(() => error);
        })
      );
  }

  updateRecurringBuy(scheduleId: string, payload: {
    units?: number;
    targetAmount?: number;
    frequency?: string;
    nextRunDate?: string;
    active?: boolean;
  }): Observable<RecurringBuySchedule> {
    return this.http.patch<ApiResponse<RecurringBuySchedule>>(`${this.apiUrl}/recurring-buys/${encodeURIComponent(scheduleId)}`, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to update recurring buy');
        }),
        catchError(error => {
          console.error('Error updating recurring buy:', error);
          return throwError(() => error);
        })
      );
  }

  deleteRecurringBuy(scheduleId: string): Observable<{ id: string; removed: number }> {
    return this.http.delete<ApiResponse<{ id: string; removed: number }>>(`${this.apiUrl}/recurring-buys/${encodeURIComponent(scheduleId)}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to remove recurring buy');
        }),
        catchError(error => {
          console.error('Error removing recurring buy:', error);
          return throwError(() => error);
        })
      );
  }

  placeOrder(accountId: string, payload: {
    action?: 'BUY' | 'SELL';
    symbol?: string;
    units?: number;
    orderType?: string;
    timeInForce?: string;
    limitPrice?: number;
    stopPrice?: number;
    notionalValue?: number;
    tradeId?: string;
  }): Observable<TradeExecution> {
    return this.http.post<ApiResponse<TradeExecution>>(`${this.apiUrl}/accounts/${encodeURIComponent(accountId)}/orders`, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to place order');
        }),
        catchError(error => {
          console.error('Error placing order:', error);
          return throwError(() => error);
        })
      );
  }

  getPortfolioSnapshots(): Observable<PortfolioBalanceSnapshot[]> {
    return this.http.get<ApiResponse<PortfolioBalanceSnapshot[]>>(`${this.apiUrl}/portfolio/snapshots`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load portfolio snapshots');
        }),
        catchError(error => {
          console.error('Error fetching portfolio snapshots:', error);
          return throwError(() => error);
        })
      );
  }

  getAccountSnapshots(accountId: string): Observable<AccountBalanceSnapshot[]> {
    return this.http.get<ApiResponse<AccountBalanceSnapshot[]>>(`${this.apiUrl}/accounts/${encodeURIComponent(accountId)}/snapshots`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load account snapshots');
        }),
        catchError(error => {
          console.error('Error fetching account snapshots:', {
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            body: error.error,
            message: error.message
          });
          return throwError(() => error);
        })
      );
  }

  getDividendIncome(refresh = false): Observable<DividendIncomeSummary> {
    return this.http.get<ApiResponse<DividendIncomeSummary>>(`${this.apiUrl}/dividend-income`, {
      params: refresh ? { refresh: 'true' } : {}
    })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load dividend income');
        }),
        catchError(error => {
          console.error('Error fetching dividend income:', error);
          return throwError(() => error);
        })
      );
  }

  updateDividendIncomePreference(preference: { symbol: string; currency: string; paymentFrequency: string; hidden?: boolean }): Observable<{ symbol: string; currency: string; paymentFrequency: string; paymentsPerYear: number; hidden?: boolean }> {
    return this.http.patch<ApiResponse<{ symbol: string; currency: string; paymentFrequency: string; paymentsPerYear: number; hidden?: boolean }>>(`${this.apiUrl}/dividend-income/preferences`, preference)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to update dividend income preference');
        }),
        catchError(error => {
          console.error('Error updating dividend income preference:', error);
          return throwError(() => error);
        })
      );
  }

  hideDividendIncomePreference(preference: { symbol: string; currency: string; paymentFrequency?: string }): Observable<{ symbol: string; currency: string; paymentFrequency: string; paymentsPerYear: number; hidden?: boolean }> {
    return this.http.delete<ApiResponse<{ symbol: string; currency: string; paymentFrequency: string; paymentsPerYear: number; hidden?: boolean }>>(`${this.apiUrl}/dividend-income/preferences`, {
      body: preference
    })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to remove dividend income preference');
        }),
        catchError(error => {
          console.error('Error removing dividend income preference:', error);
          return throwError(() => error);
        })
      );
  }

  clearDividendIncomePreferences(symbols: { symbol: string; currency: string }[]): Observable<{ removed: number }> {
    return this.http.delete<ApiResponse<{ removed: number }>>(`${this.apiUrl}/dividend-income/preferences/symbols`, {
      body: { symbols }
    })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to clear dividend income changes');
        }),
        catchError(error => {
          console.error('Error clearing dividend income changes:', error);
          return throwError(() => error);
        })
      );
  }

  updateAccountPreference(accountId: string, preference: { nickname?: string | null; marginBalance?: number | null; marginInterestRate?: number | null; hidden?: boolean }): Observable<{ accountId: string; nickname?: string | null; marginBalance?: number | null; marginInterestRate?: number | null; hidden: boolean }> {
    return this.http.patch<ApiResponse<{ accountId: string; nickname?: string | null; marginBalance?: number | null; marginInterestRate?: number | null; hidden: boolean }>>(`${this.apiUrl}/accounts/${accountId}/preference`, preference)
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
