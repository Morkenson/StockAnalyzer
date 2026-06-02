import { test, expect } from '../fixtures/auth.fixture';

const MOCK_PORTFOLIO = {
  totalBalance: 15_000.0,
  allTimeGainLoss: 2_000.0,
  allTimeGainLossPercent: 15.38,
  accounts: [
    {
      id: 'acc-1',
      name: 'Robinhood',
      nickname: 'My Portfolio',
      accountNumber: '****1234',
      accountType: 'INDIVIDUAL',
      currency: 'USD',
      brokerageId: 'ROBINHOOD',
      totalValue: 15_000.0,
      holdingsCount: 5,
    },
  ],
  holdings: [],
};

test.describe('Settings', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Global mocks required for every authenticated page (nav, watchlist service)
    await authenticatedPage.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_PORTFOLIO }),
      })
    );
  });

  test('shows the signed-in user email', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    // Email appears in the result-value section of the account info grid
    await expect(page.locator('.result-value').filter({ hasText: 'test@example.com' })).toBeVisible();
  });

  test('Send Reset Link button triggers password reset request', async ({ authenticatedPage: page }) => {
    await page.route('**/api/auth/request-password-reset', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { message: 'Reset link sent' } }),
      })
    );
    await page.goto('/settings');

    const resetResp = page.waitForResponse((resp) =>
      resp.url().includes('/auth/request-password-reset') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    await resetResp;

    await expect(page.locator('.success-message').first()).toBeVisible();
  });

  test('password form shows mismatch error when passwords differ', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    await page.locator('#resetToken').fill('some-valid-token');
    await page.locator('#newPassword').fill('validpassword123');
    await page.locator('#confirmNewPassword').fill('differentpassword456');
    await page.locator('#confirmNewPassword').blur();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('Reset Password button is disabled with invalid form', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Reset Password' })).toBeDisabled();
  });

  test('resets password successfully', async ({ authenticatedPage: page }) => {
    await page.route('**/api/auth/reset-password', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    );
    await page.goto('/settings');
    await page.locator('#resetToken').fill('valid-token-123');
    await page.locator('#newPassword').fill('mynewpassword123');
    await page.locator('#confirmNewPassword').fill('mynewpassword123');

    const resetResp = page.waitForResponse(
      (resp) => resp.url().includes('/auth/reset-password') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Reset Password' }).click();
    await resetResp;

    await expect(page.getByText('Password reset successfully.')).toBeVisible();
  });
});
