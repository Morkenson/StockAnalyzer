import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, debounceTime } from 'rxjs';
import { CashflowService } from '../services/cashflow.service';
import { TaxesService } from '../services/taxes.service';
import { TaxCalculationResult, TaxProfileInputs } from '../models/taxes.model';

@Component({
  selector: 'app-taxes',
  template: `
    <div class="taxes-page">
      <section class="page-hero taxes-hero">
        <div>
          <p class="page-kicker">Planning</p>
          <h1>Taxes</h1>
          <p class="hero-subtitle">Estimate federal income tax, FICA, and Wisconsin state tax from your annual income picture.</p>
        </div>
        <div class="hero-tax-chip">
          <span>Tax Year</span>
          <strong>{{ taxForm.value.taxYear }}</strong>
        </div>
      </section>

      <div class="taxes-layout">
        <section class="card tax-form-card">
          <div class="card-header">
            <div>
              <span>Tax Inputs</span>
              <p>Wisconsin estimate, not tax advice.</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" (click)="refreshIncome()" [disabled]="loadingIncome">
              {{ loadingIncome ? 'Refreshing...' : 'Refresh Income' }}
            </button>
          </div>

          <form [formGroup]="taxForm" (ngSubmit)="save()" class="tax-form">
            <div class="form-row">
              <div class="form-group">
                <label for="filingStatus">Filing Status</label>
                <select id="filingStatus" formControlName="filingStatus" class="form-input">
                  <option value="single">Single</option>
                  <option value="married_joint">Married Filing Jointly</option>
                  <option value="head_of_household">Head of Household</option>
                </select>
              </div>
              <div class="form-group">
                <label for="taxYear">Tax Year</label>
                <input id="taxYear" type="number" formControlName="taxYear" min="2025" step="1" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label for="grossIncome">Gross Income ($)</label>
              <input id="grossIncome" type="number" formControlName="grossIncome" min="0" step="100" class="form-input" />
              <p class="field-hint" *ngIf="incomeHint">{{ incomeHint }}</p>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="preTaxContributions">Pre-tax Contributions ($)</label>
                <input id="preTaxContributions" type="number" formControlName="preTaxContributions" min="0" step="100" class="form-input" />
              </div>
              <div class="form-group">
                <label for="withholdingsPaid">Withholdings Paid ($)</label>
                <input id="withholdingsPaid" type="number" formControlName="withholdingsPaid" min="0" step="100" class="form-input" />
              </div>
            </div>

            <div class="deduction-toggle" role="group" aria-label="Deduction type">
              <button type="button" [class.active]="!taxForm.value.useItemized" (click)="setDeduction(false)">Standard</button>
              <button type="button" [class.active]="taxForm.value.useItemized" (click)="setDeduction(true)">Itemized</button>
            </div>

            <div class="form-group" *ngIf="taxForm.value.useItemized">
              <label for="itemizedDeduction">Itemized Deduction ($)</label>
              <input id="itemizedDeduction" type="number" formControlName="itemizedDeduction" min="0" step="100" class="form-input" />
            </div>

            <div class="state-row">
              <span>State</span>
              <strong>Wisconsin</strong>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="saving || taxForm.invalid">
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
              <span class="save-message" *ngIf="saveMessage">{{ saveMessage }}</span>
            </div>
          </form>
        </section>

        <section class="card tax-results-card" aria-live="polite">
          <div class="card-header">
            <div>
              <span>Estimated Taxes Due</span>
              <p *ngIf="calculation">Effective rate {{ calculation.effectiveRate | number:'1.2-2' }}%</p>
            </div>
          </div>

          <div *ngIf="calculating" class="empty-state">Calculating...</div>
          <div *ngIf="!calculating && !calculation" class="empty-state">Enter income details to see an estimate.</div>

          <ng-container *ngIf="!calculating && calculation">
            <div class="balance-panel" [class.refund]="calculation.balanceDue < 0">
              <span>{{ calculation.balanceDue < 0 ? 'Estimated Refund' : 'Estimated Balance Due' }}</span>
              <strong>{{ abs(calculation.balanceDue) | currency:'USD':'symbol':'1.0-0' }}</strong>
            </div>
            <div class="breakdown-list">
              <div><span>AGI</span><strong>{{ calculation.agi | currency:'USD':'symbol':'1.0-0' }}</strong></div>
              <div><span>Deduction</span><strong>{{ calculation.deduction | currency:'USD':'symbol':'1.0-0' }}</strong></div>
              <div><span>Taxable Income</span><strong>{{ calculation.taxableIncome | currency:'USD':'symbol':'1.0-0' }}</strong></div>
              <div><span>Federal Income Tax</span><strong>{{ calculation.federalTax | currency:'USD':'symbol':'1.0-0' }}</strong></div>
              <div><span>FICA</span><strong>{{ calculation.ficaTax | currency:'USD':'symbol':'1.0-0' }}</strong></div>
              <div class="sub-line"><span>Social Security</span><strong>{{ calculation.socialSecurityTax | currency:'USD':'symbol':'1.0-0' }}</strong></div>
              <div class="sub-line"><span>Medicare</span><strong>{{ calculation.medicareTax + calculation.additionalMedicareTax | currency:'USD':'symbol':'1.0-0' }}</strong></div>
              <div><span>Wisconsin State Tax</span><strong>{{ calculation.stateTax | currency:'USD':'symbol':'1.0-0' }}</strong></div>
              <div><span>Total Tax</span><strong>{{ calculation.totalTax | currency:'USD':'symbol':'1.0-0' }}</strong></div>
              <div><span>Withholdings Paid</span><strong>{{ calculation.withholdingsPaid | currency:'USD':'symbol':'1.0-0' }}</strong></div>
            </div>
          </ng-container>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .taxes-page { display: flex; flex-direction: column; gap: var(--spacing-lg); }
    .taxes-hero { align-items: center; }
    .hero-tax-chip {
      min-width: 130px;
      padding: var(--spacing-md);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md, 8px);
      text-align: right;
      background: rgba(255, 255, 255, 0.03);
    }
    .hero-tax-chip span, .field-hint, .save-message { color: var(--color-text-secondary); font-size: var(--font-size-sm); }
    .hero-tax-chip strong { display: block; font-size: var(--font-size-xl); }
    .taxes-layout { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr); gap: var(--spacing-lg); align-items: start; }
    .tax-form { display: flex; flex-direction: column; gap: var(--spacing-md); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }
    .deduction-toggle { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--color-border); border-radius: var(--border-radius-md, 8px); overflow: hidden; }
    .deduction-toggle button {
      min-height: 42px;
      border: 0;
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      font: inherit;
    }
    .deduction-toggle button.active { background: var(--color-primary); color: white; }
    .state-row, .form-actions, .breakdown-list div {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--spacing-md);
    }
    .state-row {
      padding: var(--spacing-sm) 0;
      border-top: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
    }
    .form-actions { justify-content: flex-start; }
    .tax-results-card { position: sticky; top: 96px; }
    .balance-panel {
      padding: var(--spacing-lg);
      border-radius: var(--border-radius-md, 8px);
      border: 1px solid rgba(239, 68, 68, 0.45);
      background: rgba(239, 68, 68, 0.08);
      margin-bottom: var(--spacing-md);
    }
    .balance-panel.refund { border-color: rgba(34, 197, 94, 0.45); background: rgba(34, 197, 94, 0.08); }
    .balance-panel span { display: block; color: var(--color-text-secondary); }
    .balance-panel strong { font-size: var(--font-size-2xl); }
    .breakdown-list { display: flex; flex-direction: column; gap: var(--spacing-sm); }
    .breakdown-list div { padding-bottom: var(--spacing-sm); border-bottom: 1px solid var(--color-border); }
    .breakdown-list .sub-line { padding-left: var(--spacing-md); color: var(--color-text-secondary); font-size: var(--font-size-sm); }
    .empty-state { color: var(--color-text-secondary); padding: var(--spacing-lg) 0; text-align: center; }
    @media (max-width: 900px) {
      .taxes-layout, .form-row { grid-template-columns: 1fr; }
      .tax-results-card { position: static; }
      .hero-tax-chip { text-align: left; width: 100%; }
    }
  `]
})
export class TaxesComponent implements OnInit, OnDestroy {
  taxForm: FormGroup;
  calculation: TaxCalculationResult | null = null;
  loadingIncome = false;
  calculating = false;
  saving = false;
  saveMessage = '';
  incomeHint = '';
  private savedProfileLoaded = false;
  private grossIncomeTouched = false;
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private taxesService: TaxesService,
    private cashflowService: CashflowService
  ) {
    this.taxForm = this.fb.group({
      taxYear: [2025, [Validators.required, Validators.min(2025)]],
      filingStatus: ['single', [Validators.required]],
      grossIncome: [0, [Validators.required, Validators.min(0)]],
      preTaxContributions: [0, [Validators.min(0)]],
      useItemized: [false],
      itemizedDeduction: [0, [Validators.min(0)]],
      withholdingsPaid: [0, [Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(this.taxForm.get('grossIncome')?.valueChanges.subscribe(() => {
      if (this.savedProfileLoaded) {
        this.grossIncomeTouched = true;
      }
    }));
    this.subscriptions.add(this.taxForm.valueChanges.pipe(debounceTime(300)).subscribe(() => this.calculate()));
    this.loadProfileAndIncome();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async loadProfileAndIncome(): Promise<void> {
    try {
      const profile = await this.taxesService.getProfile();
      if (profile) {
        this.taxForm.patchValue(profile, { emitEvent: false });
      }
      this.savedProfileLoaded = true;
      await this.refreshIncome(!profile || !profile.grossIncome);
      await this.calculate();
    } catch (error: any) {
      this.incomeHint = error?.message || 'Unable to load saved tax inputs.';
      this.savedProfileLoaded = true;
    }
  }

  async refreshIncome(onlyIfEmpty = false): Promise<void> {
    if (onlyIfEmpty && (this.grossIncomeTouched || Number(this.taxForm.value.grossIncome) > 0)) {
      return;
    }
    this.loadingIncome = true;
    try {
      const year = Number(this.taxForm.value.taxYear) || new Date().getFullYear();
      const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
      const entriesByMonth = await Promise.all(months.map(month => this.cashflowService.getEntries(month)));
      const grossIncome = entriesByMonth
        .flat()
        .filter(entry => entry.type === 'income')
        .reduce((total, entry) => total + Number(entry.amount || 0), 0);
      this.taxForm.patchValue({ grossIncome: Math.round(grossIncome * 100) / 100 });
      this.grossIncomeTouched = false;
      this.incomeHint = grossIncome > 0
        ? 'Pulled from your income section for this tax year.'
        : 'No income entries found for this tax year yet.';
    } catch {
      this.incomeHint = 'Unable to refresh income from cashflow.';
    } finally {
      this.loadingIncome = false;
    }
  }

  setDeduction(useItemized: boolean): void {
    this.taxForm.patchValue({ useItemized });
  }

  async calculate(): Promise<void> {
    if (this.taxForm.invalid) {
      this.calculation = null;
      return;
    }
    this.calculating = true;
    try {
      this.calculation = await this.taxesService.calculate(this.payload());
    } catch {
      this.calculation = null;
    } finally {
      this.calculating = false;
    }
  }

  async save(): Promise<void> {
    if (this.taxForm.invalid) {
      this.taxForm.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.saveMessage = '';
    try {
      await this.taxesService.saveProfile(this.payload());
      this.saveMessage = 'Saved.';
    } catch (error: any) {
      this.saveMessage = error?.error?.message || error?.message || 'Unable to save.';
    } finally {
      this.saving = false;
    }
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  private payload(): TaxProfileInputs {
    const value = this.taxForm.value;
    return {
      taxYear: Number(value.taxYear) || 2025,
      filingStatus: value.filingStatus,
      grossIncome: Number(value.grossIncome) || 0,
      preTaxContributions: Number(value.preTaxContributions) || 0,
      useItemized: !!value.useItemized,
      itemizedDeduction: Number(value.itemizedDeduction) || 0,
      withholdingsPaid: Number(value.withholdingsPaid) || 0
    };
  }
}
