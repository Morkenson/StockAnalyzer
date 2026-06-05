import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  template: `
    <div class="login-container">
      <section class="auth-story">
        <p class="page-kicker">Mork Wealth</p>
        <h1>Back to your money.</h1>
        <p>Forgot your password? We'll email you a secure link to set a new one.</p>
      </section>

      <!-- Step 1: Request reset -->
      <div class="login-card" *ngIf="!submitted">
        <div class="login-header">
          <h1>Reset password</h1>
          <p>Enter your email and we'll send you a reset link.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="Enter your email"
              [class.error]="form.get('email')?.invalid && form.get('email')?.touched"
              autocomplete="email"
            />
            <div class="error-message" *ngIf="form.get('email')?.invalid && form.get('email')?.touched">
              <span *ngIf="form.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="form.get('email')?.errors?.['email']">Please enter a valid email</span>
            </div>
          </div>

          <div class="error-message" *ngIf="errorMessage">{{ errorMessage }}</div>

          <button type="submit" class="submit-button" [disabled]="form.invalid || isLoading">
            <span *ngIf="!isLoading">Send reset link</span>
            <span *ngIf="isLoading">Sending...</span>
          </button>
        </form>

        <div class="login-footer">
          <p>Remembered it? <a routerLink="/login" class="link">Back to sign in</a></p>
        </div>
      </div>

      <!-- Step 2: Confirmation -->
      <div class="login-card" *ngIf="submitted">
        <div class="login-header">
          <h1>Check your email</h1>
          <p>If an account exists for <strong>{{ submittedEmail }}</strong>, a password reset link is on its way. It expires in 30 minutes.</p>
        </div>

        <div class="login-footer">
          <p><a routerLink="/login" class="link">Back to sign in</a></p>
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent implements OnInit {
  form!: FormGroup;
  isLoading = false;
  submitted = false;
  submittedEmail = '';
  errorMessage = '';

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
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    const { email } = this.form.value;
    try {
      const { error } = await this.authService.requestPasswordReset(email);
      if (error) {
        this.errorMessage = error.message || 'Failed to send reset link. Please try again.';
        return;
      }
      this.submittedEmail = email;
      this.submitted = true;
    } catch (err: any) {
      this.errorMessage = err.message || 'An unexpected error occurred.';
    } finally {
      this.isLoading = false;
    }
  }
}
