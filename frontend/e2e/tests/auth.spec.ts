import { test, expect } from '../fixtures/auth.fixture';

test.describe('Login page', () => {
  test.beforeEach(async ({ unauthenticatedPage }) => {
    await unauthenticatedPage.goto('/login');
  });

  test('renders branding and form fields', async ({ unauthenticatedPage: page }) => {
    await expect(page.locator('.page-kicker')).toHaveText('Mork Wealth');
    await expect(page.locator('h1').first()).toHaveText('Your money, clearer.');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('submit button is disabled when form is empty', async ({ unauthenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });

  test('shows email validation error on blur', async ({ unauthenticatedPage: page }) => {
    await page.locator('#email').fill('not-an-email');
    await page.locator('#email').blur();
    await expect(page.getByText('Please enter a valid email')).toBeVisible();
  });

  test('shows password length error on blur', async ({ unauthenticatedPage: page }) => {
    await page.locator('#password').fill('short');
    await page.locator('#password').blur();
    await expect(page.getByText('Password must be at least 12 characters')).toBeVisible();
  });

  test('submit button enables with valid credentials', async ({ unauthenticatedPage: page }) => {
    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('validpassword123');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  test('shows error message on invalid credentials', async ({ unauthenticatedPage: page }) => {
    await page.route('**/api/auth/signin', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Invalid credentials' }),
      })
    );

    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('wrongpassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.locator('.error-message').filter({ hasText: 'Invalid credentials' })).toBeVisible();
  });

  test('shows OTP step after successful login', async ({ unauthenticatedPage: page }) => {
    await page.route('**/api/auth/signin', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { pendingUserId: 'pending-123' } }),
      })
    );

    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('validpassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.locator('#code')).toBeVisible();
  });

  test('links to signup page', async ({ unauthenticatedPage: page }) => {
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/signup');
  });
});

test.describe('Signup page', () => {
  test.beforeEach(async ({ unauthenticatedPage }) => {
    await unauthenticatedPage.goto('/signup');
  });

  test('renders branding and form fields', async ({ unauthenticatedPage: page }) => {
    await expect(page.locator('.page-kicker')).toHaveText('Mork Wealth');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('submit button is disabled when form is empty', async ({ unauthenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeDisabled();
  });

  test('shows password mismatch error', async ({ unauthenticatedPage: page }) => {
    await page.locator('#password').fill('validpassword123');
    await page.locator('#confirmPassword').fill('differentpassword123');
    await page.locator('#confirmPassword').blur();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('shows OTP step after successful signup', async ({ unauthenticatedPage: page }) => {
    await page.route('**/api/auth/signup', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { pendingUserId: 'pending-456' } }),
      })
    );

    await page.locator('#email').fill('newuser@example.com');
    await page.locator('#password').fill('validpassword123');
    await page.locator('#confirmPassword').fill('validpassword123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText('Verify your email')).toBeVisible();
  });

  test('links to login page', async ({ unauthenticatedPage: page }) => {
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Forgot password page', () => {
  test('login page links to forgot password', async ({ unauthenticatedPage: page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL('/forgot-password');
  });

  test.describe('with navigation', () => {
    test.beforeEach(async ({ unauthenticatedPage }) => {
      await unauthenticatedPage.goto('/forgot-password');
    });

    test('renders branding and email field', async ({ unauthenticatedPage: page }) => {
      await expect(page.locator('.page-kicker')).toHaveText('Mork Wealth');
      await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
    });

    test('submit button is disabled when email is empty', async ({ unauthenticatedPage: page }) => {
      await expect(page.getByRole('button', { name: 'Send reset link' })).toBeDisabled();
    });

    test('shows email validation error on blur', async ({ unauthenticatedPage: page }) => {
      await page.locator('#email').fill('not-an-email');
      await page.locator('#email').blur();
      await expect(page.getByText('Please enter a valid email')).toBeVisible();
    });

    test('shows confirmation after submitting', async ({ unauthenticatedPage: page }) => {
      await page.route('**/api/auth/request-password-reset', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'If that email exists, a reset link will be sent.' }),
        })
      );

      await page.locator('#email').fill('user@example.com');
      await page.getByRole('button', { name: 'Send reset link' }).click();

      await expect(page.getByText('Check your email')).toBeVisible();
      await expect(page.getByText('user@example.com')).toBeVisible();
    });

    test('shows confirmation even on error response (no enumeration)', async ({ unauthenticatedPage: page }) => {
      // The backend returns success for unknown emails; the UI surfaces backend errors only.
      await page.route('**/api/auth/request-password-reset', (route) =>
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, detail: 'Too many attempts. Try again later.' }),
        })
      );

      await page.locator('#email').fill('user@example.com');
      await page.getByRole('button', { name: 'Send reset link' }).click();

      await expect(page.locator('.error-message').filter({ hasText: 'Too many attempts' })).toBeVisible();
    });

    test('links back to login', async ({ unauthenticatedPage: page }) => {
      await page.getByRole('link', { name: 'Back to sign in' }).click();
      await expect(page).toHaveURL('/login');
    });
  });
});

test.describe('Reset password page', () => {
  test('shows invalid-link state when token is missing', async ({ unauthenticatedPage: page }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'Link not valid' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible();
  });

  test.describe('with valid token in URL', () => {
    test.beforeEach(async ({ unauthenticatedPage }) => {
      await unauthenticatedPage.goto('/reset-password?token=valid-token-123');
    });

    test('renders password fields', async ({ unauthenticatedPage: page }) => {
      await expect(page.getByRole('heading', { name: 'Set new password' })).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#confirmPassword')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reset password' })).toBeVisible();
    });

    test('submit button is disabled when form is empty', async ({ unauthenticatedPage: page }) => {
      await expect(page.getByRole('button', { name: 'Reset password' })).toBeDisabled();
    });

    test('shows password length error on blur', async ({ unauthenticatedPage: page }) => {
      await page.locator('#password').fill('short');
      await page.locator('#password').blur();
      await expect(page.getByText('Password must be at least 12 characters')).toBeVisible();
    });

    test('shows password mismatch error', async ({ unauthenticatedPage: page }) => {
      await page.locator('#password').fill('validpassword123');
      await page.locator('#confirmPassword').fill('differentpassword123');
      await page.locator('#confirmPassword').blur();
      await expect(page.getByText('Passwords do not match')).toBeVisible();
    });

    test('shows success after resetting password', async ({ unauthenticatedPage: page }) => {
      await page.route('**/api/auth/reset-password', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Password reset successfully' }),
        })
      );

      await page.locator('#password').fill('validpassword123');
      await page.locator('#confirmPassword').fill('validpassword123');
      await page.getByRole('button', { name: 'Reset password' }).click();

      await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Go to sign in' })).toBeVisible();
    });

    test('shows error on expired or invalid token', async ({ unauthenticatedPage: page }) => {
      await page.route('**/api/auth/reset-password', (route) =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, detail: 'Invalid or expired reset token' }),
        })
      );

      await page.locator('#password').fill('validpassword123');
      await page.locator('#confirmPassword').fill('validpassword123');
      await page.getByRole('button', { name: 'Reset password' }).click();

      await expect(page.locator('.error-message').filter({ hasText: 'Invalid or expired reset token' })).toBeVisible();
    });
  });
});
