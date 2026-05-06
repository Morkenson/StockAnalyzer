import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup',
  template: `
    <div class="signup-container">
      <section class="auth-story">
        <p class="page-kicker">Mork Wealth</p>
        <h1>Start building your view.</h1>
        <p>Create an account to track markets, portfolios, and debt planning in one place.</p>
      </section>

      <!-- Step 1: Registration form -->
      <div class="signup-card" *ngIf="step === 'signup'">
        <div class="signup-header">
          <h1>Create account</h1>
          <p>Set up your Mork Wealth login.</p>
        </div>

        <form [formGroup]="signupForm" (ngSubmit)="onSubmit()" class="signup-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="Enter your email"
              [class.error]="signupForm.get('email')?.invalid && signupForm.get('email')?.touched"
              autocomplete="email"
            />
            <div class="error-message" *ngIf="signupForm.get('email')?.invalid && signupForm.get('email')?.touched">
              <span *ngIf="signupForm.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="signupForm.get('email')?.errors?.['email']">Please enter a valid email</span>
            </div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="Create a password (min. 12 characters)"
              [class.error]="signupForm.get('password')?.invalid && signupForm.get('password')?.touched"
              autocomplete="new-password"
            />
            <div class="error-message" *ngIf="signupForm.get('password')?.invalid && signupForm.get('password')?.touched">
              <span *ngIf="signupForm.get('password')?.errors?.['required']">Password is required</span>
              <span *ngIf="signupForm.get('password')?.errors?.['minlength']">Password must be at least 12 characters</span>
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              placeholder="Confirm your password"
              [class.error]="signupForm.get('confirmPassword')?.invalid && signupForm.get('confirmPassword')?.touched"
              autocomplete="new-password"
            />
            <div class="error-message" *ngIf="signupForm.get('confirmPassword')?.invalid && signupForm.get('confirmPassword')?.touched">
              <span *ngIf="signupForm.get('confirmPassword')?.errors?.['required']">Please confirm your password</span>
              <span *ngIf="signupForm.get('confirmPassword')?.errors?.['passwordMismatch']">Passwords do not match</span>
            </div>
          </div>

          <div class="error-message" *ngIf="errorMessage">{{ errorMessage }}</div>

          <button type="submit" class="submit-button" [disabled]="signupForm.invalid || isLoading">
            <span *ngIf="!isLoading">Create Account</span>
            <span *ngIf="isLoading">Creating account...</span>
          </button>
        </form>

        <div class="signup-footer">
          <p>Already have an account? <a routerLink="/login" class="link">Sign in</a></p>
        </div>
      </div>

      <!-- Step 2: Email verification -->
      <div class="signup-card" *ngIf="step === 'otp'">
        <div class="signup-header">
          <h1>Verify your email</h1>
          <p>We sent a 6-digit code to <strong>{{ pendingEmail }}</strong>. Enter it to activate your account.</p>
        </div>

        <form [formGroup]="otpForm" (ngSubmit)="onOtpSubmit()" class="signup-form">
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
            <span *ngIf="!isLoading">Verify Email</span>
            <span *ngIf="isLoading">Verifying...</span>
          </button>
        </form>

        <div class="signup-footer otp-footer">
          <button type="button" class="link-btn" (click)="resendCode()" [disabled]="resendCooldown > 0 || isResending">
            <span *ngIf="isResending">Sending...</span>
            <span *ngIf="!isResending && resendCooldown > 0">Resend in {{ resendCooldown }}s</span>
            <span *ngIf="!isResending && resendCooldown === 0">Resend code</span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SignupComponent implements OnInit, OnDestroy {
  signupForm!: FormGroup;
  otpForm!: FormGroup;
  step: 'signup' | 'otp' = 'signup';
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
    this.signupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(12)]],
      confirmPassword: ['', [Validators.required]],
    }, { validators: this.passwordMatchValidator });
    this.otpForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnDestroy(): void {
    this.clearCooldown();
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword) {
      confirmPassword.setErrors(null);
    }
    return null;
  }

  async onSubmit(): Promise<void> {
    if (this.signupForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    const { email, password } = this.signupForm.value;
    try {
      const { user, pendingUserId, error } = await this.authService.signUp(email, password);
      if (error) {
        this.errorMessage = error.message || 'Failed to create account. Please try again.';
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
      this.errorMessage = err.message || 'An unexpected error occurred. Please try again.';
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
