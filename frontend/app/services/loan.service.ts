import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Loan, LoanRow } from '../models/loan.model';
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
export class LoanService {
  private loansSubject = new BehaviorSubject<Loan[]>([]);
  public loans$ = this.loansSubject.asObservable();
  private apiUrl = environment.api.baseUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.loadLoansFromCache(user.id);
        this.loadLoans();
      } else {
        this.loansSubject.next([]);
        this.clearLoanCache();
      }
    });
  }

  getLoans(): Observable<Loan[]> {
    return this.loans$;
  }

  getCurrentLoans(): Loan[] {
    return this.loansSubject.value;
  }

  async refreshLoans(): Promise<void> {
    await this.loadLoans();
  }

  async createLoan(loan: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Loan> {
    this.requireUser();
    const response = await firstValueFrom(
      this.http.post<ApiResponse<LoanRow>>(`${this.apiUrl}/loans`, {
        name: loan.name.trim(),
        principal: loan.principal,
        interestRate: loan.interestRate,
        loanTerm: loan.loanTerm,
        monthlyPayment: loan.monthlyPayment,
        totalAmountPaid: loan.totalAmountPaid,
        totalInterest: loan.totalInterest,
        notes: loan.notes?.trim() || null
      })
    );
    await this.loadLoans();
    return this.mapLoanRow(response.data!);
  }

  async updateLoan(loanId: string, updates: Partial<Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    this.requireUser();
    await firstValueFrom(
      this.http.patch<ApiResponse<LoanRow>>(`${this.apiUrl}/loans/${loanId}`, updates)
    );
    await this.loadLoans();
  }

  async deleteLoan(loanId: string): Promise<void> {
    this.requireUser();
    await firstValueFrom(
      this.http.delete<ApiResponse<void>>(`${this.apiUrl}/loans/${loanId}`)
    );
    await this.loadLoans();
  }

  private async loadLoans(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.loansSubject.next([]);
      return;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<LoanRow[]>>(`${this.apiUrl}/loans`)
      );
      const loans = (response.data || []).map(row => this.mapLoanRow(row));
      this.loansSubject.next(loans);
      this.saveLoansToCache(user.id, loans);
    } catch (error) {
      console.error('Error loading loans from API:', error);
      this.loansSubject.next([]);
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
    return `loans_cache_${userId}`;
  }

  private loadLoansFromCache(userId: string): void {
    try {
      const cached = localStorage.getItem(this.getCacheKey(userId));
      if (cached) {
        this.loansSubject.next(JSON.parse(cached).map((loan: any) => ({
          ...loan,
          createdAt: new Date(loan.createdAt),
          updatedAt: new Date(loan.updatedAt)
        })));
      }
    } catch {
      localStorage.removeItem(this.getCacheKey(userId));
    }
  }

  private saveLoansToCache(userId: string, loans: Loan[]): void {
    localStorage.setItem(this.getCacheKey(userId), JSON.stringify(loans));
  }

  private clearLoanCache(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('loans_cache_')) {
        localStorage.removeItem(key);
      }
    });
  }

  private mapLoanRow(row: LoanRow): Loan {
    return {
      id: row.id,
      name: row.name,
      principal: row.principal,
      interestRate: row.interestRate,
      loanTerm: row.loanTerm,
      monthlyPayment: row.monthlyPayment,
      totalAmountPaid: row.totalAmountPaid,
      totalInterest: row.totalInterest,
      notes: row.notes || undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}
