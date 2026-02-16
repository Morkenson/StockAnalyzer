import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Loan, LoanRow } from '../models/loan.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class LoanService {
  private loansSubject = new BehaviorSubject<Loan[]>([]);
  public loans$ = this.loansSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {
    // Load loans when user logs in
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

  /**
   * Get all loans
   */
  getLoans(): Observable<Loan[]> {
    return this.loans$;
  }

  /**
   * Get current loans snapshot (for explicit refresh after update/delete)
   */
  getCurrentLoans(): Loan[] {
    return this.loansSubject.value;
  }

  /**
   * Force reload loans from Supabase and update state (use after update/delete/edit)
   */
  async refreshLoans(): Promise<void> {
    await this.loadLoans();
  }

  /**
   * Create a new loan
   */
  async createLoan(loan: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Loan> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('loans')
        .insert({
          user_id: user.id,
          name: loan.name.trim(),
          principal: loan.principal,
          interest_rate: loan.interestRate,
          loan_term: loan.loanTerm,
          monthly_payment: loan.monthlyPayment,
          total_amount_paid: loan.totalAmountPaid,
          total_interest: loan.totalInterest,
          notes: loan.notes?.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      await this.loadLoans();
      return this.mapLoanRow(data);
    } catch (error) {
      console.error('Error creating loan:', error);
      throw error;
    }
  }

  /**
   * Update a loan
   */
  async updateLoan(loanId: string, updates: Partial<Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.principal !== undefined) updateData.principal = updates.principal;
      if (updates.interestRate !== undefined) updateData.interest_rate = updates.interestRate;
      if (updates.loanTerm !== undefined) updateData.loan_term = updates.loanTerm;
      if (updates.monthlyPayment !== undefined) updateData.monthly_payment = updates.monthlyPayment;
      if (updates.totalAmountPaid !== undefined) updateData.total_amount_paid = updates.totalAmountPaid;
      if (updates.totalInterest !== undefined) updateData.total_interest = updates.totalInterest;
      if (updates.notes !== undefined) updateData.notes = updates.notes?.trim() || null;

      const { error } = await this.supabaseService.client
        .from('loans')
        .update(updateData)
        .eq('id', loanId)
        .eq('user_id', user.id);

      if (error) throw error;

      await this.loadLoans();
    } catch (error) {
      console.error('Error updating loan:', error);
      throw error;
    }
  }

  /**
   * Delete a loan
   */
  async deleteLoan(loanId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { error } = await this.supabaseService.client
        .from('loans')
        .delete()
        .eq('id', loanId)
        .eq('user_id', user.id);

      if (error) throw error;

      await this.loadLoans();
    } catch (error) {
      console.error('Error deleting loan:', error);
      throw error;
    }
  }

  /**
   * Get cache key for localStorage
   */
  private getCacheKey(userId: string): string {
    return `loans_cache_${userId}`;
  }

  /**
   * Load loans from localStorage cache
   */
  private loadLoansFromCache(userId: string): void {
    try {
      const cacheKey = this.getCacheKey(userId);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const loans: Loan[] = JSON.parse(cached).map((l: any) => ({
          ...l,
          createdAt: new Date(l.createdAt),
          updatedAt: new Date(l.updatedAt)
        }));
        this.loansSubject.next(loans);
      }
    } catch (error) {
      console.error('Error loading loans from cache:', error);
    }
  }

  /**
   * Save loans to localStorage cache
   */
  private saveLoansToCache(userId: string, loans: Loan[]): void {
    try {
      const cacheKey = this.getCacheKey(userId);
      localStorage.setItem(cacheKey, JSON.stringify(loans));
    } catch (error) {
      console.error('Error saving loans to cache:', error);
    }
  }

  /**
   * Clear loan cache
   */
  private clearLoanCache(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('loans_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing loan cache:', error);
    }
  }

  /**
   * Load all loans from Supabase
   */
  private async loadLoans(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.loansSubject.next([]);
      return;
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('loans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const loans: Loan[] = (data || []).map((row: LoanRow) => this.mapLoanRow(row));

      this.loansSubject.next(loans);
      this.saveLoansToCache(user.id, loans);
    } catch (error) {
      console.error('Error loading loans from Supabase:', error);
      this.loansSubject.next([]);
    }
  }

  /**
   * Map database row to Loan interface
   */
  private mapLoanRow(row: LoanRow): Loan {
    return {
      id: row.id,
      name: row.name,
      principal: row.principal,
      interestRate: row.interest_rate,
      loanTerm: row.loan_term,
      monthlyPayment: row.monthly_payment,
      totalAmountPaid: row.total_amount_paid,
      totalInterest: row.total_interest,
      notes: row.notes || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
