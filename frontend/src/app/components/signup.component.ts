import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup',
  template: `
    <div class="signup-container">
      <div class="signup-card">
        <div class="signup-header">
          <h1>Create Account</h1>
          <p>Sign up to get started with Midnight Wealth</p>
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
              placeholder="Create a password (min. 6 characters)"
              [class.error]="signupForm.get('password')?.invalid && signupForm.get('password')?.touched"
              autocomplete="new-password"
            />
            <div class="error-message" *ngIf="signupForm.get('password')?.invalid && signupForm.get('password')?.touched">
              <span *ngIf="signupForm.get('password')?.errors?.['required']">Password is required</span>
              <span *ngIf="signupForm.get('password')?.errors?.['minlength']">Password must be at least 6 characters</span>
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

          <div class="error-message" *ngIf="errorMessage">
            {{ errorMessage }}
          </div>

          <div class="success-message" *ngIf="successMessage">
            {{ successMessage }}
          </div>

          <button
            type="submit"
            class="submit-button"
            [disabled]="signupForm.invalid || isLoading"
          >
            <span *ngIf="!isLoading">Create Account</span>
            <span *ngIf="isLoading">Creating account...</span>
          </button>
        </form>

        <div class="signup-footer">
          <p>
            Already have an account?
            <a routerLink="/login" class="link">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../styles/components/signup.component.scss']
})
export class SignupComponent implements OnInit {
  signupForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.signupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
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
    if (this.signupForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { email, password } = this.signupForm.value;

    try {
      const { user, error } = await this.authService.signUp(email, password);

      if (error) {
        this.errorMessage = error.message || 'Failed to create account. Please try again.';
        this.isLoading = false;
        return;
      }

      if (user) {
        this.successMessage = 'Account created successfully! Please check your email to verify your account.';
        // Optionally redirect to login after a delay
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      }
    } catch (error: any) {
      this.errorMessage = error.message || 'An unexpected error occurred. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}

