import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <div class="login-container">
      <section class="auth-story">
        <p class="page-kicker">Mork Wealth</p>
        <h1>Your money, clearer.</h1>
        <p>Track stocks, watchlists, portfolios, and payoff plans from one calm workspace.</p>
      </section>

      <!-- Step 1: Email + password -->
      <div class="login-card" *ngIf="step === 'login'">
        <div class="login-header">
          <h1>Welcome back</h1>
          <p>Sign in to continue.</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="Enter your email"
              [class.error]="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
              autocomplete="email"
            />
            <div class="error-message" *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched">
              <span *ngIf="loginForm.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="loginForm.get('email')?.errors?.['email']">Please enter a valid email</span>
            </div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="Enter your password"
              [class.error]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
              autocomplete="current-password"
            />
            <div class="error-message" *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched">
              <span *ngIf="loginForm.get('password')?.errors?.['required']">Password is required</span>
              <span *ngIf="loginForm.get('password')?.errors?.['minlength']">Password must be at least 12 characters</span>
            </div>
          </div>

          <div class="error-message" *ngIf="errorMessage">{{ errorMessage }}</div>

          <button type="submit" class="submit-button" [disabled]="loginForm.invalid || isLoading">
            <span *ngIf="!isLoading">Sign In</span>
            <span *ngIf="isLoading">Signing in...</span>
          </button>
        </form>

        <div class="login-footer">
          <p>Don't have an account? <a routerLink="/signup" class="link">Sign up</a></p>
        </div>
      </div>

      <!-- Step 2: OTP verification -->
      <div class="login-card" *ngIf="step === 'otp'">
        <div class="login-header">
          <h1>Check your email</h1>
          <p>We sent a 6-digit code to <strong>{{ pendingEmail }}</strong>.</p>
        </div>

        <form [formGroup]="otpForm" (ngSubmit)="onOtpSubmit()" class="login-form">
          <div class="form-group">
            <label for="code">Verification code</label>
            <input
              id="code"
              type="text"
              formControlName="code"
              placeholder="000000"
              maxlength="6"
              autocomplete="one-time-code"
              inputmode="numeric"
              [class.error]="otpForm.get('code')?.invalid && otpForm.get('code')?.touched"
            />
            <div class="error-message" *ngIf="otpForm.get('code')?.invalid && otpForm.get('code')?.touched">
              <span>Enter the 6-digit code from your email</span>
            </div>
          </div>

          <div class="error-message" *ngIf="errorMessage">{{ errorMessage }}</div>

          <button type="submit" class="submit-button" [disabled]="otpForm.invalid || isLoading">
            <span *ngIf="!isLoading">Verify</span>
            <span *ngIf="isLoading">Verifying...</span>
          </button>
        </form>

        <div class="login-footer otp-footer">
          <button type="button" class="link-btn" (click)="resendCode()" [disabled]="resendCooldown > 0 || isResending">
            <span *ngIf="isResending">Sending...</span>
            <span *ngIf="!isResending && resendCooldown > 0">Resend in {{ resendCooldown }}s</span>
            <span *ngIf="!isResending && resendCooldown === 0">Resend code</span>
          </button>
          <span class="otp-sep">·</span>
          <button type="button" class="link-btn" (click)="backToLogin()">Back</button>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  otpForm!: FormGroup;
  step: 'login' | 'otp' = 'login';
  pendingUserId = '';
  pendingEmail = '';
  isLoading = false;
  isResending = false;
  errorMessage = '';
  resendCooldown = 0;
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(12)]],
    });
    this.otpForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnDestroy(): void {
    this.clearCooldown();
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    const { email, password } = this.loginForm.value;
    try {
      const { user, pendingUserId, error } = await this.authService.signIn(email, password);
      if (error) {
        this.errorMessage = error.message || 'Failed to sign in. Please check your credentials.';
        return;
      }
      if (pendingUserId) {
        this.pendingUserId = pendingUserId;
        this.pendingEmail = email;
        this.step = 'otp';
        this.startCooldown(60);
        return;
      }
      if (user) {
        this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      this.errorMessage = err.message || 'An unexpected error occurred.';
    } finally {
      this.isLoading = false;
    }
  }

  async onOtpSubmit(): Promise<void> {
    if (this.otpForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const { user, error } = await this.authService.verifyOtp(this.pendingUserId, this.otpForm.value.code);
      if (error) {
        this.errorMessage = error.message || 'Invalid code. Please try again.';
        return;
      }
      if (user) {
        this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      this.errorMessage = err.message || 'An unexpected error occurred.';
    } finally {
      this.isLoading = false;
    }
  }

  async resendCode(): Promise<void> {
    if (this.resendCooldown > 0 || this.isResending) return;
    this.isResending = true;
    this.errorMessage = '';
    try {
      const { error } = await this.authService.resendOtp(this.pendingUserId);
      if (error) {
        this.errorMessage = error.message || 'Failed to resend code.';
        return;
      }
      this.startCooldown(60);
    } catch (err: any) {
      this.errorMessage = err.message || 'An unexpected error occurred.';
    } finally {
      this.isResending = false;
    }
  }

  backToLogin(): void {
    this.step = 'login';
    this.pendingUserId = '';
    this.pendingEmail = '';
    this.errorMessage = '';
    this.otpForm.reset();
    this.clearCooldown();
  }

  private startCooldown(seconds: number): void {
    this.clearCooldown();
    this.resendCooldown = seconds;
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        this.clearCooldown();
      }
    }, 1000);
  }

  private clearCooldown(): void {
    if (this.cooldownTimer !== null) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.resendCooldown = 0;
  }
}
