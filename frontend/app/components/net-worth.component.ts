import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Asset } from '../models/asset.model';
import { AssetService } from '../services/asset.service';
import { Loan } from '../models/loan.model';
import { Portfolio } from '../models/snaptrade.model';
import { LoanService } from '../services/loan.service';
import { SnapTradeService } from '../services/snaptrade.service';

@Component({
  selector: 'app-net-worth',
  template: `
    <div class="dashboard">
      <section class="page-hero">
        <div>
          <p class="page-kicker">Balance sheet</p>
          <h1>Net Worth</h1>
          <p class="dashboard-subtitle">Add connected portfolios and manual assets, then subtract saved loan principal.</p>
        </div>
        <div class="hero-actions">
          <button type="button" class="btn btn-secondary" (click)="toggleDebtCalculator()">
            Debt
          </button>
          <button type="button" class="btn btn-primary" (click)="openAssetForm()">
            Add Asset
          </button>
        </div>
      </section>

      <section class="card totals-card" aria-live="polite">
        <div class="card-header">
          <div>
            <span>Total Net Worth</span>
            <p>Connected portfolios + manual assets - saved debt principal</p>
          </div>
        </div>
        <div class="aggregate-totals">
          <div class="total-item">
            <span class="total-label">Net Worth</span>
            <span class="total-value highlight">\${{ totalNetWorth | number:'1.2-2' }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Connected Portfolios</span>
            <span class="total-value">\${{ connectedPortfolioValue | number:'1.2-2' }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Manual Assets</span>
            <span class="total-value">\${{ totalAssetValue | number:'1.2-2' }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Total Debt</span>
            <span class="total-value negative">{{ totalDebtPrincipal > 0 ? '-' : '' }}\${{ totalDebtPrincipal | number:'1.2-2' }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Tracked Assets</span>
            <span class="total-value">{{ assets.length }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Saved Loans</span>
            <span class="total-value">{{ loans.length }}</span>
          </div>
        </div>
        <p class="card-description" *ngIf="portfolioLoading">Loading connected portfolios...</p>
        <p class="card-description" *ngIf="portfolioError">{{ portfolioError }}</p>
      </section>

      <section *ngIf="showDebtCalculator" class="net-worth-debt-section">
        <app-debt-calculator></app-debt-calculator>
      </section>

      <div class="grid grid-3" *ngIf="assets.length > 0">
        <div class="result-item">
          <span class="result-label">Manual Assets</span>
          <span class="result-value highlight">\${{ totalAssetValue | number:'1.2-2' }}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Tracked Assets</span>
          <span class="result-value">{{ assets.length }}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Largest Asset</span>
          <span class="result-value">{{ largestAssetName }}</span>
        </div>
      </div>

      <div class="card" *ngIf="showAssetForm">
        <div class="card-header">
          <span>Add Asset</span>
          <button type="button" class="btn btn-secondary btn-sm" (click)="closeAssetForm()">
            Back to list
          </button>
        </div>

        <form [formGroup]="assetForm" (ngSubmit)="saveAsset()">
          <div class="grid grid-2">
            <div class="form-group">
              <label for="assetName">Asset Name</label>
              <input
                id="assetName"
                type="text"
                formControlName="name"
                placeholder="e.g., Brokerage Account"
                class="form-input"
              />
              <div class="form-error" *ngIf="assetForm.get('name')?.hasError('required') && assetForm.get('name')?.touched">
                Asset name is required
              </div>
            </div>

            <div class="form-group">
              <label for="assetType">Asset Type</label>
              <select id="assetType" formControlName="assetType" class="form-input">
                <option *ngFor="let type of assetTypes" [value]="type">{{ type }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="assetValue">Current Value ($)</label>
              <input
                id="assetValue"
                type="number"
                formControlName="value"
                placeholder="e.g., 25000"
                min="0"
                step="0.01"
                class="form-input"
              />
              <div class="form-error" *ngIf="assetForm.get('value')?.hasError('required') && assetForm.get('value')?.touched">
                Current value is required
              </div>
              <div class="form-error" *ngIf="assetForm.get('value')?.hasError('min')">
                Value must be 0 or greater
              </div>
            </div>

            <div class="form-group">
              <label for="institution">Institution</label>
              <input
                id="institution"
                type="text"
                formControlName="institution"
                placeholder="e.g., Fidelity, Chase"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="assetNotes">Notes</label>
            <textarea
              id="assetNotes"
              formControlName="notes"
              placeholder="Add optional details about this asset..."
              rows="3"
              class="form-input"
            ></textarea>
          </div>

          <div class="error-message" *ngIf="errorMessage">
            {{ errorMessage }}
          </div>

          <button type="submit" class="btn btn-primary" [disabled]="assetForm.invalid || isSaving">
            {{ isSaving ? 'Saving...' : 'Save Asset' }}
          </button>
        </form>
      </div>

      <div *ngIf="assets.length === 0 && !showAssetForm" class="empty-state">
        <h3>No assets yet</h3>
        <p>Add your first manual asset to round out your net worth.</p>
        <button type="button" class="btn btn-primary" (click)="openAssetForm()">Add Asset</button>
      </div>

      <div class="grid grid-3" *ngIf="assets.length > 0">
        <article class="loan-item" *ngFor="let asset of assets">
          <div class="loan-header">
            <div class="loan-name-section">
              <h3>{{ asset.name }}</h3>
              <span class="loan-date">{{ asset.assetType }}</span>
            </div>
            <button type="button" class="btn btn-danger btn-sm" (click)="deleteAsset(asset)" [disabled]="deletingAssetId === asset.id">
              {{ deletingAssetId === asset.id ? 'Deleting...' : 'Delete' }}
            </button>
          </div>

          <div class="loan-details">
            <div class="loan-detail-item">
              <span class="detail-label">Value</span>
              <span class="detail-value highlight">\${{ asset.value | number:'1.2-2' }}</span>
            </div>
            <div class="loan-detail-item" *ngIf="asset.institution">
              <span class="detail-label">Institution</span>
              <span class="detail-value">{{ asset.institution }}</span>
            </div>
          </div>

          <div class="loan-notes" *ngIf="asset.notes">
            <span class="notes-label">Notes</span>
            <span class="notes-text">{{ asset.notes }}</span>
          </div>
        </article>
      </div>
    </div>
  `,
})
export class NetWorthComponent implements OnInit, OnDestroy {
  assets: Asset[] = [];
  loans: Loan[] = [];
  assetForm!: FormGroup;
  assetTypes = ['Cash', 'Brokerage', 'Retirement', 'Real Estate', 'Vehicle', 'Business', 'Other'];
  showAssetForm = false;
  isSaving = false;
  deletingAssetId = '';
  errorMessage = '';
  showDebtCalculator = false;
  connectedPortfolioValue = 0;
  portfolioLoading = false;
  portfolioError = '';
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private assetService: AssetService,
    private loanService: LoanService,
    private snapTradeService: SnapTradeService
  ) {}

  ngOnInit(): void {
    this.assetForm = this.fb.group({
      name: ['', [Validators.required]],
      assetType: ['Cash', [Validators.required]],
      value: [null, [Validators.required, Validators.min(0)]],
      institution: [''],
      notes: ['']
    });

    this.subscriptions.add(
      this.assetService.getAssets().subscribe(assets => {
        this.assets = assets;
      })
    );

    this.subscriptions.add(
      this.loanService.getLoans().subscribe(loans => {
        this.loans = loans;
      })
    );

    this.loadConnectedPortfolio();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get totalNetWorth(): number {
    return this.connectedPortfolioValue + this.totalAssetValue - this.totalDebtPrincipal;
  }

  get totalAssetValue(): number {
    return this.assets.reduce((total, asset) => total + asset.value, 0);
  }

  get totalDebtPrincipal(): number {
    return this.loans.reduce((total, loan) => total + loan.principal, 0);
  }

  get largestAssetName(): string {
    if (!this.assets.length) {
      return 'None';
    }
    return this.assets.reduce((largest, asset) => asset.value > largest.value ? asset : largest, this.assets[0]).name;
  }

  private loadConnectedPortfolio(): void {
    this.portfolioLoading = true;
    this.portfolioError = '';

    this.subscriptions.add(
      this.snapTradeService.getPortfolio().subscribe({
        next: (portfolio: Portfolio) => {
          this.connectedPortfolioValue = portfolio.totalBalance || 0;
          this.portfolioLoading = false;
        },
        error: (error: any) => {
          this.connectedPortfolioValue = 0;
          this.portfolioLoading = false;

          if (error?.status === 404) {
            return;
          }

          this.portfolioError = 'Connected portfolios are unavailable right now. Manual assets and debt are still included.';
        }
      })
    );
  }

  openAssetForm(): void {
    this.showAssetForm = true;
    this.errorMessage = '';
  }

  toggleDebtCalculator(): void {
    this.showDebtCalculator = !this.showDebtCalculator;
  }

  closeAssetForm(): void {
    this.showAssetForm = false;
    this.errorMessage = '';
    this.assetForm.reset({ assetType: 'Cash' });
  }

  async saveAsset(): Promise<void> {
    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    try {
      const { name, assetType, value, institution, notes } = this.assetForm.value;
      await this.assetService.createAsset({
        name,
        assetType,
        value: Number(value),
        institution,
        notes
      });
      this.closeAssetForm();
    } catch (error: any) {
      this.errorMessage = error?.error?.detail || error?.message || 'Unable to save asset.';
    } finally {
      this.isSaving = false;
    }
  }

  async deleteAsset(asset: Asset): Promise<void> {
    this.deletingAssetId = asset.id;
    this.errorMessage = '';

    try {
      await this.assetService.deleteAsset(asset.id);
    } catch (error: any) {
      this.errorMessage = error?.error?.detail || error?.message || 'Unable to delete asset.';
    } finally {
      this.deletingAssetId = '';
    }
  }
}
