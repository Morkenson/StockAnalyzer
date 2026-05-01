import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoanService } from '../services/loan.service';
import { Loan } from '../models/loan.model';
import { Subscription } from 'rxjs';

interface PaymentScheduleEntry {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

@Component({
  selector: 'app-debt-calculator',
  template: `
    <div class="debt-calculator">
      <div class="calculator-header">
        <h1>Debt Calculator</h1>
        <p class="calculator-subtitle">Calculate your loan payments and manage your debts</p>
      </div>

      <!-- Calculator section: shown when Add Loan is clicked or when editing -->
      <div class="calculator-section" *ngIf="showCalculator || editingLoanId">
        <div class="calculator-section-header">
          <h2>{{ editingLoanId ? 'Edit Loan' : 'Add New Loan' }}</h2>
          <button type="button" class="btn btn-secondary btn-sm" *ngIf="showCalculator && !editingLoanId" (click)="closeCalculator()">
            Back to list
          </button>
        </div>

      <div class="calculator-container">
        <div class="card calculator-form-card">
          <div class="card-header">
            <span>Loan Details</span>
          </div>
          <form [formGroup]="calculatorForm" (ngSubmit)="calculatePayment()">
            <div class="form-group">
              <label for="loanName">Loan Name</label>
              <input
                type="text"
                id="loanName"
                formControlName="loanName"
                placeholder="e.g., Car Loan, Mortgage"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="principal">Principal Amount ($)</label>
              <input
                type="number"
                id="principal"
                formControlName="principal"
                placeholder="e.g., 10000"
                min="0"
                step="0.01"
                class="form-input"
              />
              <div class="form-error" *ngIf="calculatorForm.get('principal')?.hasError('required') && calculatorForm.get('principal')?.touched">
                Principal is required
              </div>
              <div class="form-error" *ngIf="calculatorForm.get('principal')?.hasError('min')">
                Principal must be greater than 0
              </div>
            </div>

            <div class="form-group">
              <label for="interestRate">Annual Interest Rate (%)</label>
              <input
                type="number"
                id="interestRate"
                formControlName="interestRate"
                placeholder="e.g., 5.5"
                min="0"
                max="100"
                step="0.01"
                class="form-input"
              />
              <div class="form-error" *ngIf="calculatorForm.get('interestRate')?.hasError('required') && calculatorForm.get('interestRate')?.touched">
                Interest rate is required
              </div>
              <div class="form-error" *ngIf="calculatorForm.get('interestRate')?.hasError('min')">
                Interest rate must be 0 or greater
              </div>
            </div>

            <div class="form-group">
              <label for="loanTerm">Loan Term (months)</label>
              <input
                type="number"
                id="loanTerm"
                formControlName="loanTerm"
                placeholder="e.g., 60"
                min="1"
                step="1"
                class="form-input"
              />
              <div class="form-error" *ngIf="calculatorForm.get('loanTerm')?.hasError('required') && calculatorForm.get('loanTerm')?.touched">
                Loan term is required
              </div>
              <div class="form-error" *ngIf="calculatorForm.get('loanTerm')?.hasError('min')">
                Loan term must be at least 1 month
              </div>
            </div>

            <div class="form-group">
              <label for="notes">Notes (optional)</label>
              <textarea
                id="notes"
                formControlName="notes"
                placeholder="Add any notes about this loan..."
                rows="3"
                class="form-input"
              ></textarea>
            </div>

            <button type="submit" class="btn btn-primary btn-block" [disabled]="calculatorForm.invalid">
              Calculate Payment
            </button>
            
            <button 
              type="button" 
              class="btn btn-secondary btn-block" 
              *ngIf="monthlyPayment > 0 && !editingLoanId"
              (click)="saveLoan()"
              [disabled]="savingLoan">
              {{ savingLoan ? 'Saving...' : 'Save Loan' }}
            </button>

            <button 
              type="button" 
              class="btn btn-secondary btn-block" 
              *ngIf="editingLoanId"
              (click)="updateLoan()"
              [disabled]="savingLoan">
              {{ savingLoan ? 'Updating...' : 'Update Loan' }}
            </button>

            <button 
              type="button" 
              class="btn btn-secondary btn-block" 
              *ngIf="editingLoanId"
              (click)="cancelEdit()">
              Cancel Edit
            </button>
          </form>
        </div>

        <div class="card results-card" *ngIf="monthlyPayment > 0">
          <div class="card-header">
            <span>Payment Summary</span>
          </div>
          <div class="results-summary">
            <div class="result-item">
              <span class="result-label">Monthly Payment</span>
              <span class="result-value">\${{ monthlyPayment | number:'1.2-2' }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Total Amount Paid</span>
              <span class="result-value">\${{ totalAmountPaid | number:'1.2-2' }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Total Interest</span>
              <span class="result-value">\${{ totalInterest | number:'1.2-2' }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Daily Interest</span>
              <span class="result-value">\${{ dailyInterest | number:'1.2-2' }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Weekly Interest</span>
              <span class="result-value">\${{ weeklyInterest | number:'1.2-2' }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Loan Term</span>
              <span class="result-value">{{ loanTerm }} months ({{ (loanTerm / 12) | number:'1.1-1' }} years)</span>
            </div>
          </div>
        </div>
      </div>
      </div>
      <!-- End calculator section -->

      <!-- Totals at top -->
      <div class="card totals-card">
        <div class="card-header">
          <span>Totals</span>
        </div>
        <div class="aggregate-totals">
          <div class="total-item">
            <span class="total-label">Total Monthly Payments</span>
            <span class="total-value">\${{ totalMonthlyPayments | number:'1.2-2' }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Total Principal</span>
            <span class="total-value">\${{ totalPrincipal | number:'1.2-2' }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Total Interest</span>
            <span class="total-value highlight">\${{ totalInterestAllLoans | number:'1.2-2' }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Total Amount to Pay</span>
            <span class="total-value highlight">\${{ totalAmountAllLoans | number:'1.2-2' }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Total Daily Interest</span>
            <span class="total-value">\${{ totalDailyInterest | number:'1.2-2' }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Total Weekly Interest</span>
            <span class="total-value">\${{ totalWeeklyInterest | number:'1.2-2' }}</span>
          </div>
        </div>
      </div>

      <!-- Main screen: Saved Loans list -->
      <div class="card saved-loans-card">
        <div class="card-header saved-loans-header">
          <div class="saved-loans-title">
            <span>Saved Loans</span>
            <span class="card-badge" *ngIf="loans.length > 0">{{ loans.length }}</span>
          </div>
          <button type="button" class="btn btn-primary" (click)="openCalculator()">
            + Add Loan
          </button>
        </div>
        <div class="loans-list" *ngIf="loans.length > 0">
          <div class="loan-item" *ngFor="let loan of loans">
            <div class="loan-header">
              <div class="loan-name-section">
                <h3>{{ loan.name || 'Unnamed Loan' }}</h3>
                <span class="loan-date">{{ loan.createdAt | date:'short' }}</span>
              </div>
              <div class="loan-actions">
                <button class="btn btn-sm btn-secondary" (click)="editLoan(loan)" title="Edit loan">
                  Edit
                </button>
                <button class="btn btn-sm btn-danger" (click)="deleteLoan(loan.id)" title="Delete loan">
                  Delete
                </button>
              </div>
            </div>
            <div class="loan-details">
              <div class="loan-detail-item">
                <span class="detail-label">Principal:</span>
                <span class="detail-value">\${{ loan.principal | number:'1.2-2' }}</span>
              </div>
              <div class="loan-detail-item">
                <span class="detail-label">Interest Rate:</span>
                <span class="detail-value">{{ loan.interestRate }}%</span>
              </div>
              <div class="loan-detail-item">
                <span class="detail-label">Term:</span>
                <span class="detail-value">{{ loan.loanTerm }} months</span>
              </div>
              <div class="loan-detail-item">
                <span class="detail-label">Monthly Payment:</span>
                <span class="detail-value highlight">\${{ loan.monthlyPayment | number:'1.2-2' }}</span>
              </div>
              <div class="loan-detail-item">
                <span class="detail-label">Total Interest:</span>
                <span class="detail-value">\${{ loan.totalInterest | number:'1.2-2' }}</span>
              </div>
              <div class="loan-detail-item">
                <span class="detail-label">Daily Interest:</span>
                <span class="detail-value">\${{ (loan.principal * loan.interestRate / 100 / 365) | number:'1.2-2' }}</span>
              </div>
              <div class="loan-detail-item">
                <span class="detail-label">Weekly Interest:</span>
                <span class="detail-value">\${{ (loan.principal * loan.interestRate / 100 / 52) | number:'1.2-2' }}</span>
              </div>
            </div>
            <div class="loan-notes" *ngIf="loan.notes">
              <span class="notes-label">Notes:</span>
              <span class="notes-text">{{ loan.notes }}</span>
            </div>
          </div>
        </div>
        <div class="empty-loans" *ngIf="loans.length === 0">
          <p class="empty-loans-message">No loans yet. Add a loan to track your debt and see totals.</p>
          <button type="button" class="btn btn-primary" (click)="openCalculator()">+ Add Loan</button>
        </div>
      </div>

      <div class="card payment-options-card" *ngIf="(showCalculator || editingLoanId) && monthlyPayment > 0">
        <div class="card-header">
          <span>Custom Payment Calculator</span>
        </div>
        <p class="card-description">See how different payment amounts affect your payoff time</p>
        <div class="form-group">
          <label for="customPayment">Monthly Payment Amount ($)</label>
          <input
            type="number"
            id="customPayment"
            [(ngModel)]="customPayment"
            (ngModelChange)="calculateCustomPayment()"
            placeholder="e.g., {{ monthlyPayment | number:'1.0-0' }}"
            min="0"
            step="0.01"
            class="form-input"
          />
        </div>
        <div class="custom-results" *ngIf="customPayment > 0 && customMonthsToPayoff > 0">
          <div class="result-item">
            <span class="result-label">Months to Payoff</span>
            <span class="result-value highlight">{{ customMonthsToPayoff }} months</span>
          </div>
          <div class="result-item">
            <span class="result-label">Total Interest Saved</span>
            <span class="result-value highlight positive">
              \${{ (totalInterest - customTotalInterest) | number:'1.2-2' }}
            </span>
          </div>
          <div class="result-item">
            <span class="result-label">Time Saved</span>
            <span class="result-value highlight positive">
              {{ (loanTerm - customMonthsToPayoff) }} months
            </span>
          </div>
        </div>
      </div>

      <div class="card schedule-card" *ngIf="(showCalculator || editingLoanId) && paymentSchedule.length > 0">
        <div class="card-header">
          <span>Amortization Schedule</span>
          <button class="btn btn-secondary btn-sm" (click)="showFullSchedule = !showFullSchedule">
            {{ showFullSchedule ? 'Show Less' : 'Show Full Schedule' }}
          </button>
        </div>
        <div class="schedule-container">
          <table class="schedule-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Payment</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Remaining Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of (showFullSchedule ? paymentSchedule : paymentSchedule.slice(0, 12))">
                <td>{{ entry.month }}</td>
                <td>\${{ entry.payment | number:'1.2-2' }}</td>
                <td>\${{ entry.principal | number:'1.2-2' }}</td>
                <td>\${{ entry.interest | number:'1.2-2' }}</td>
                <td>\${{ entry.remainingBalance | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
          <div class="schedule-note" *ngIf="paymentSchedule.length > 12 && !showFullSchedule">
            Showing first 12 months. Click "Show Full Schedule" to see all {{ paymentSchedule.length }} months.
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../styles/components/debt-calculator.component.scss']
})
export class DebtCalculatorComponent implements OnInit, OnDestroy {
  calculatorForm: FormGroup;
  monthlyPayment = 0;
  totalAmountPaid = 0;
  totalInterest = 0;
  dailyInterest = 0;
  weeklyInterest = 0;
  loanTerm = 0;
  paymentSchedule: PaymentScheduleEntry[] = [];
  showFullSchedule = false;
  customPayment = 0;
  customMonthsToPayoff = 0;
  customTotalInterest = 0;
  
  loans: Loan[] = [];
  editingLoanId: string | null = null;
  savingLoan = false;
  showCalculator = false;
  private loansSubscription?: Subscription;

  // Aggregate totals
  totalMonthlyPayments = 0;
  totalPrincipal = 0;
  totalInterestAllLoans = 0;
  totalAmountAllLoans = 0;
  totalDailyInterest = 0;
  totalWeeklyInterest = 0;

  constructor(
    private fb: FormBuilder,
    private loanService: LoanService,
    private cdr: ChangeDetectorRef
  ) {
    this.calculatorForm = this.fb.group({
      loanName: [''],
      principal: ['', [Validators.required, Validators.min(0.01)]],
      interestRate: ['', [Validators.required, Validators.min(0)]],
      loanTerm: ['', [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  ngOnInit(): void {
    // Subscribe to loans
    this.loansSubscription = this.loanService.loans$.subscribe(loans => {
      this.loans = loans;
      this.calculateAggregateTotals();
    });
  }

  ngOnDestroy(): void {
    this.loansSubscription?.unsubscribe();
  }

  calculatePayment(): void {
    if (this.calculatorForm.invalid) {
      return;
    }

    const principal = parseFloat(this.calculatorForm.value.principal);
    const annualRate = parseFloat(this.calculatorForm.value.interestRate) / 100;
    const months = parseInt(this.calculatorForm.value.loanTerm, 10);

    this.loanTerm = months;
    const monthlyRate = annualRate / 12;

    // Calculate monthly payment using standard amortization formula
    if (monthlyRate === 0) {
      // No interest - simple division
      this.monthlyPayment = principal / months;
    } else {
      this.monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) /
                            (Math.pow(1 + monthlyRate, months) - 1);
    }

    this.totalAmountPaid = this.monthlyPayment * months;
    this.totalInterest = this.totalAmountPaid - principal;
    
    // Calculate daily interest: (Principal * Annual Rate) / 365
    this.dailyInterest = (principal * annualRate) / 365;
    
    // Calculate weekly interest: (Principal * Annual Rate) / 52
    this.weeklyInterest = (principal * annualRate) / 52;

    // Generate amortization schedule
    this.generatePaymentSchedule(principal, monthlyRate, months);
  }

  generatePaymentSchedule(principal: number, monthlyRate: number, months: number): void {
    this.paymentSchedule = [];
    let remainingBalance = principal;

    for (let month = 1; month <= months; month++) {
      const interest = remainingBalance * monthlyRate;
      const principalPayment = this.monthlyPayment - interest;
      remainingBalance = Math.max(0, remainingBalance - principalPayment);

      this.paymentSchedule.push({
        month,
        payment: this.monthlyPayment,
        principal: principalPayment,
        interest,
        remainingBalance
      });
    }
  }

  calculateCustomPayment(): void {
    if (this.customPayment <= 0 || this.monthlyPayment <= 0) {
      this.customMonthsToPayoff = 0;
      this.customTotalInterest = 0;
      return;
    }

    const principal = parseFloat(this.calculatorForm.value.principal);
    const annualRate = parseFloat(this.calculatorForm.value.interestRate) / 100;
    const monthlyRate = annualRate / 12;

    if (monthlyRate === 0) {
      // No interest - simple division
      this.customMonthsToPayoff = Math.ceil(principal / this.customPayment);
      this.customTotalInterest = 0;
    } else {
      // Calculate months to payoff with custom payment
      // Using formula: n = -log(1 - (P * r) / A) / log(1 + r)
      // where P = principal, r = monthly rate, A = monthly payment
      const months = -Math.log(1 - (principal * monthlyRate) / this.customPayment) / Math.log(1 + monthlyRate);
      this.customMonthsToPayoff = Math.ceil(months);
      this.customTotalInterest = (this.customPayment * this.customMonthsToPayoff) - principal;
    }
  }

  async saveLoan(): Promise<void> {
    if (this.monthlyPayment <= 0) {
      return;
    }

    this.savingLoan = true;
    try {
      const loanName = this.calculatorForm.value.loanName?.trim() || `Loan ${this.loans.length + 1}`;
      
      await this.loanService.createLoan({
        name: loanName,
        principal: parseFloat(this.calculatorForm.value.principal),
        interestRate: parseFloat(this.calculatorForm.value.interestRate),
        loanTerm: parseInt(this.calculatorForm.value.loanTerm, 10),
        monthlyPayment: this.monthlyPayment,
        totalAmountPaid: this.totalAmountPaid,
        totalInterest: this.totalInterest,
        notes: this.calculatorForm.value.notes?.trim() || undefined
      });

      // Force refresh and recalculate so list and totals update
      await this.loanService.refreshLoans();
      this.loans = [...this.loanService.getCurrentLoans()];
      this.calculateAggregateTotals();
      this.cdr.detectChanges();
      this.resetForm();
    } catch (error: any) {
      console.error('Error saving loan:', error);
      alert('Failed to save loan: ' + (error.message || 'Unknown error'));
    } finally {
      this.savingLoan = false;
    }
  }

  openCalculator(): void {
    this.showCalculator = true;
    this.cancelEdit();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeCalculator(): void {
    this.showCalculator = false;
    this.cancelEdit();
  }

  editLoan(loan: Loan): void {
    this.editingLoanId = loan.id;
    this.calculatorForm.patchValue({
      loanName: loan.name,
      principal: loan.principal,
      interestRate: loan.interestRate,
      loanTerm: loan.loanTerm,
      notes: loan.notes || ''
    });
    
    // Calculate payment for the edited loan
    this.calculatePayment();
    
    // Scroll to top so calculator is in view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async updateLoan(): Promise<void> {
    if (!this.editingLoanId || this.monthlyPayment <= 0) {
      return;
    }

    this.savingLoan = true;
    try {
      const loanName = this.calculatorForm.value.loanName?.trim() || `Loan ${this.loans.length + 1}`;
      
      await this.loanService.updateLoan(this.editingLoanId, {
        name: loanName,
        principal: parseFloat(this.calculatorForm.value.principal),
        interestRate: parseFloat(this.calculatorForm.value.interestRate),
        loanTerm: parseInt(this.calculatorForm.value.loanTerm, 10),
        monthlyPayment: this.monthlyPayment,
        totalAmountPaid: this.totalAmountPaid,
        totalInterest: this.totalInterest,
        notes: this.calculatorForm.value.notes?.trim() || undefined
      });

      // Force refresh from server and recalculate all numbers so UI updates
      await this.loanService.refreshLoans();
      this.loans = [...this.loanService.getCurrentLoans()];
      this.calculateAggregateTotals();
      this.cdr.detectChanges();
      this.cancelEdit();
      this.showCalculator = false;
    } catch (error: any) {
      console.error('Error updating loan:', error);
      alert('Failed to update loan: ' + (error.message || 'Unknown error'));
    } finally {
      this.savingLoan = false;
    }
  }

  cancelEdit(): void {
    this.editingLoanId = null;
    this.resetForm();
    // When closing edit, don't hide calculator if user opened it via Add Loan
    // showCalculator is only cleared by closeCalculator() or after save
  }

  async deleteLoan(loanId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this loan?')) {
      return;
    }

    try {
      await this.loanService.deleteLoan(loanId);
      // Force refresh from server and recalculate all numbers so UI updates
      await this.loanService.refreshLoans();
      this.loans = [...this.loanService.getCurrentLoans()];
      this.calculateAggregateTotals();
      this.cdr.detectChanges();
    } catch (error: any) {
      console.error('Error deleting loan:', error);
      alert('Failed to delete loan: ' + (error.message || 'Unknown error'));
    }
  }

  resetForm(): void {
    this.calculatorForm.patchValue({
      loanName: '',
      principal: '',
      interestRate: '',
      loanTerm: '',
      notes: ''
    });
    this.monthlyPayment = 0;
    this.totalAmountPaid = 0;
    this.totalInterest = 0;
    this.dailyInterest = 0;
    this.weeklyInterest = 0;
    this.loanTerm = 0;
    this.paymentSchedule = [];
    this.customPayment = 0;
    this.customMonthsToPayoff = 0;
    this.customTotalInterest = 0;
    this.showFullSchedule = false;
  }

  calculateAggregateTotals(): void {
    this.totalMonthlyPayments = this.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
    this.totalPrincipal = this.loans.reduce((sum, loan) => sum + loan.principal, 0);
    this.totalInterestAllLoans = this.loans.reduce((sum, loan) => sum + loan.totalInterest, 0);
    // Total Amount to Pay = Principal + Interest so the three totals always add up correctly
    this.totalAmountAllLoans = this.totalPrincipal + this.totalInterestAllLoans;
    this.totalDailyInterest = this.loans.reduce(
      (sum, loan) => sum + (loan.principal * loan.interestRate / 100 / 365),
      0
    );
    this.totalWeeklyInterest = this.loans.reduce(
      (sum, loan) => sum + (loan.principal * loan.interestRate / 100 / 52),
      0
    );
  }
}
