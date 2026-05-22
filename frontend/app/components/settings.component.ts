import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Account, Portfolio } from '../models/snaptrade.model';
import { AppUser, AuthService } from '../services/auth.service';
import { SnapTradeService } from '../services/snaptrade.service';

@Component({
  selector: 'app-settings',
  template: `
    <div class="dashboard">
      <section class="dashboard-header">
        <div>
          <span class="eyebrow">Account settings</span>
          <h1>Settings</h1>
          <p class="dashboard-subtitle">Manage sign-in access for your Mork Wealth account.</p>
        </div>
        <div class="dashboard-rail">
          <span>Signed in as</span>
          <strong>{{ currentUser?.email }}</strong>
        </div>
      </section>

      <div class="grid grid-2">
        <section class="card">
          <div class="card-header">
            <span>Password Reset</span>
          </div>
          <p class="card-description">Generate a reset token, then set a new password for this account.</p>

          <div class="result-item">
            <div>
              <span class="result-label">Reset destination</span>
              <div class="result-value">{{ currentUser?.email }}</div>
            </div>
            <button
              type="button"
              class="btn btn-secondary"
              (click)="requestResetToken()"
              [disabled]="isRequestingReset || !currentUser?.email"
            >
              <span *ngIf="!isRequestingReset">Send Reset Link</span>
              <span *ngIf="isRequestingReset">Sending...</span>
            </button>
          </div>

          <div class="success-message" *ngIf="requestMessage">
            {{ requestMessage }}
          </div>

          <form [formGroup]="passwordForm" (ngSubmit)="resetPassword()" class="grid">
            <div class="form-group">
              <label for="resetToken">Reset Token</label>
              <input
                id="resetToken"
                type="text"
                formControlName="token"
                placeholder="Paste reset token"
                autocomplete="one-time-code"
                [class.error]="passwordForm.get('token')?.invalid && passwordForm.get('token')?.touched"
              />
              <div class="error-message" *ngIf="passwordForm.get('token')?.invalid && passwordForm.get('token')?.touched">
                Reset token is required
              </div>
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label for="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  formControlName="password"
                  placeholder="At least 12 characters"
                  autocomplete="new-password"
                  [class.error]="passwordForm.get('password')?.invalid && passwordForm.get('password')?.touched"
                />
                <div class="error-message" *ngIf="passwordForm.get('password')?.invalid && passwordForm.get('password')?.touched">
                  <span *ngIf="passwordForm.get('password')?.errors?.['required']">Password is required</span>
                  <span *ngIf="passwordForm.get('password')?.errors?.['minlength']">Password must be at least 12 characters</span>
                </div>
              </div>

              <div class="form-group">
                <label for="confirmNewPassword">Confirm Password</label>
                <input
                  id="confirmNewPassword"
                  type="password"
                  formControlName="confirmPassword"
                  placeholder="Confirm new password"
                  autocomplete="new-password"
                  [class.error]="passwordsDoNotMatch"
                />
                <div class="error-message" *ngIf="passwordsDoNotMatch">
                  Passwords do not match
                </div>
              </div>
            </div>

            <div class="error-message" *ngIf="errorMessage">
              {{ errorMessage }}
            </div>

            <div class="success-message" *ngIf="successMessage">
              {{ successMessage }}
            </div>

            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="passwordForm.invalid || isResettingPassword"
            >
              <span *ngIf="!isResettingPassword">Reset Password</span>
              <span *ngIf="isResettingPassword">Resetting...</span>
            </button>
          </form>
        </section>

        <aside class="card">
          <div class="card-header">
            <span>Account Protection</span>
            <span class="card-badge">3</span>
          </div>
          <ul class="settings-checklist">
            <li>Passwords require at least 12 characters.</li>
            <li>Reset tokens expire after a short window.</li>
            <li>Used tokens cannot reset a password again.</li>
          </ul>
        </aside>
      </div>

      <section class="card settings-portfolio-card">
        <div class="card-header">
          <div>
            <span>Portfolio</span>
            <p>Connected account identifiers and display details</p>
          </div>
        </div>

        <div class="loading-state compact" *ngIf="portfolioLoading">
          <div class="spinner"></div>
          <p>Loading portfolio accounts...</p>
        </div>

        <div class="error-message compact" *ngIf="portfolioError && !portfolioLoading">
          <p>{{ portfolioError }}</p>
        </div>

        <div class="empty-state compact-empty" *ngIf="!portfolioLoading && !portfolioError && portfolioAccounts.length === 0">
          <p>No connected portfolio accounts found.</p>
        </div>

        <div class="settings-account-list" *ngIf="!portfolioLoading && !portfolioError && portfolioAccounts.length > 0">
          <article class="settings-account-panel" *ngFor="let account of portfolioAccounts">
            <div class="settings-account-panel-header">
              <div>
                <h3>{{ account.nickname || account.name || 'Portfolio Account' }}</h3>
                <p>{{ account.accountNumber || 'No account number' }} / {{ account.type || 'Unknown type' }}</p>
              </div>
              <button class="btn btn-secondary" type="button" (click)="viewAccount(account)">
                View
              </button>
            </div>

            <div class="account-detail-grid">
              <div class="account-detail-field">
                <span>Official Name</span>
                <strong>{{ account.name || 'Unavailable' }}</strong>
              </div>
              <div class="account-detail-field" *ngIf="account.nickname">
                <span>Nickname</span>
                <strong>{{ account.nickname }}</strong>
              </div>
              <div class="account-detail-field">
                <span>Account Number</span>
                <strong>{{ account.accountNumber || 'Unavailable' }}</strong>
              </div>
              <div class="account-detail-field">
                <span>Type</span>
                <strong>{{ account.type || 'Unavailable' }}</strong>
              </div>
              <div class="account-detail-field">
                <span>Brokerage ID</span>
                <strong>{{ account.brokerageId || 'Unavailable' }}</strong>
              </div>
              <div class="account-detail-field">
                <span>Currency</span>
                <strong>{{ account.currency || 'USD' }}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  `,
})
export class SettingsComponent implements OnInit, OnDestroy {
  currentUser: AppUser | null = null;
  portfolio: Portfolio | null = null;
  portfolioAccounts: Account[] = [];
  portfolioLoading = false;
  portfolioError = '';
  passwordForm!: FormGroup;
  isRequestingReset = false;
  isResettingPassword = false;
  requestMessage = '';
  successMessage = '';
  errorMessage = '';
  private userSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snapTradeService: SnapTradeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.passwordForm = this.fb.group({
      token: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(12)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.loadPortfolioAccounts();
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }

  get passwordsDoNotMatch(): boolean {
    const confirmPassword = this.passwordForm.get('confirmPassword');
    return Boolean(
      confirmPassword?.touched &&
      this.passwordForm.errors?.['passwordMismatch']
    );
  }

  async requestResetToken(): Promise<void> {
    if (!this.currentUser?.email) {
      return;
    }

    this.isRequestingReset = true;
    this.requestMessage = '';
    this.successMessage = '';
    this.errorMessage = '';

    const result = await this.authService.requestPasswordReset(this.currentUser.email);
    if (result.error) {
      this.errorMessage = result.error.message || 'Unable to start password reset.';
      this.isRequestingReset = false;
      return;
    }

    if (result.resetToken) {
      this.passwordForm.patchValue({ token: result.resetToken });
      this.requestMessage = 'Reset token generated and added below.';
    } else {
      this.requestMessage = result.message || 'If that email exists, a reset link will be sent.';
    }

    this.isRequestingReset = false;
  }

  async resetPassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isResettingPassword = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { token, password } = this.passwordForm.value;
    const result = await this.authService.resetPassword(token.trim(), password);

    if (result.error) {
      this.errorMessage = result.error.message || 'Unable to reset password.';
      this.isResettingPassword = false;
      return;
    }

    this.passwordForm.reset();
    this.requestMessage = '';
    this.successMessage = 'Password reset successfully.';
    this.isResettingPassword = false;
  }

  loadPortfolioAccounts(): void {
    this.portfolioLoading = true;
    this.portfolioError = '';

    this.snapTradeService.getPortfolio().subscribe({
      next: (portfolio) => {
        this.portfolio = portfolio;
        this.portfolioAccounts = portfolio.accounts || [];
        this.portfolioLoading = false;
      },
      error: (err) => {
        this.portfolio = null;
        this.portfolioAccounts = [];
        this.portfolioLoading = false;
        if (err.status === 404) {
          return;
        }
        this.portfolioError = err.error?.message || err.message || 'Portfolio account details are unavailable right now.';
        console.error('Error loading portfolio settings:', err);
      }
    });
  }

  viewAccount(account: Account): void {
    this.router.navigate(['/portfolio/accounts', account.id]);
  }

  private passwordMatchValidator(form: FormGroup): { passwordMismatch: boolean } | null {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}
