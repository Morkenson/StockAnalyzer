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
    await page.route('**/api/auth/login', (route) =>
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
    await page.route('**/api/auth/login', (route) =>
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

    await expect(page.getByText('Check your email')).toBeVisible();
  });

  test('links to login page', async ({ unauthenticatedPage: page }) => {
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
  });
});
