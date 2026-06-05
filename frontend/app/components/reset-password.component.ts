import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-reset-password',
  template: `
    <div class="login-container">
      <section class="auth-story">
        <p class="page-kicker">Mork Wealth</p>
        <h1>Choose a new password.</h1>
        <p>Pick something strong — at least 12 characters — and you're back in.</p>
      </section>

      <!-- Invalid / missing token -->
      <div class="login-card" *ngIf="!token">
        <div class="login-header">
          <h1>Link not valid</h1>
          <p>This password reset link is missing or malformed. Please request a new one.</p>
        </div>
        <div class="login-footer">
          <p><a routerLink="/forgot-password" class="link">Request a new link</a></p>
        </div>
      </div>

      <!-- Reset form -->
      <div class="login-card" *ngIf="token && !success">
        <div class="login-header">
          <h1>Set new password</h1>
          <p>Enter and confirm your new password.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="password">New password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="Create a password (min. 12 characters)"
              [class.error]="form.get('password')?.invalid && form.get('password')?.touched"
              autocomplete="new-password"
            />
            <div class="error-message" *ngIf="form.get('password')?.invalid && form.get('password')?.touched">
              <span *ngIf="form.get('password')?.errors?.['required']">Password is required</span>
              <span *ngIf="form.get('password')?.errors?.['minlength']">Password must be at least 12 characters</span>
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              placeholder="Confirm your password"
              [class.error]="form.get('confirmPassword')?.invalid && form.get('confirmPassword')?.touched"
              autocomplete="new-password"
            />
            <div class="error-message" *ngIf="form.get('confirmPassword')?.invalid && form.get('confirmPassword')?.touched">
              <span *ngIf="form.get('confirmPassword')?.errors?.['required']">Please confirm your password</span>
              <span *ngIf="form.get('confirmPassword')?.errors?.['passwordMismatch']">Passwords do not match</span>
            </div>
          </div>

          <div class="error-message" *ngIf="errorMessage">{{ errorMessage }}</div>

          <button type="submit" class="submit-button" [disabled]="form.invalid || isLoading">
            <span *ngIf="!isLoading">Reset password</span>
            <span *ngIf="isLoading">Resetting...</span>
          </button>
        </form>

        <div class="login-footer">
          <p><a routerLink="/login" class="link">Back to sign in</a></p>
        </div>
      </div>

      <!-- Success -->
      <div class="login-card" *ngIf="success">
        <div class="login-header">
          <h1>Password updated</h1>
          <p>Your password has been reset. You can now sign in with your new password.</p>
        </div>
        <div class="login-footer">
          <p><a routerLink="/login" class="link">Go to sign in</a></p>
        </div>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent implements OnInit {
  form!: FormGroup;
  token = '';
  isLoading = false;
  success = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.form = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(12)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator },
    );
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
    if (this.form.invalid || !this.token) return;
    this.isLoading = true;
    this.errorMessage = '';
    const { password } = this.form.value;
    try {
      const { error } = await this.authService.resetPassword(this.token, password);
      if (error) {
        this.errorMessage = error.message || 'Failed to reset password. The link may have expired.';
        return;
      }
      this.success = true;
    } catch (err: any) {
      this.errorMessage = err.message || 'An unexpected error occurred.';
    } finally {
      this.isLoading = false;
    }
  }
}
