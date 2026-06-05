import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

const MOCK_ACCOUNT = {
  id: 'acc-test-id',
  name: 'Robinhood',
  nickname: null,
  accountNumber: '****1234',
  type: 'INDIVIDUAL',
  currency: 'USD',
  brokerageId: 'ROBINHOOD',
  balance: 15_000.0,
  holdings: [],
  marginBalance: null,
  marginInterestRate: null,
};

const MOCK_PORTFOLIO_EMPTY = {
  totalBalance: 15_000.0,
  totalGainLoss: 1_500.0,
  totalGainLossPercent: 11.11,
  accounts: [],
  holdings: [],
};

const MOCK_PORTFOLIO_WITH_ACCOUNT = {
  ...MOCK_PORTFOLIO_EMPTY,
  accounts: [MOCK_ACCOUNT],
};

async function expandRobinhoodAccounts(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Robinhood.*1 account/ }).click();
}

test.describe('Portfolio', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    // Default: 404 so component shows empty state; no secondary API calls are triggered
    await authenticatedPage.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'No portfolio' }) })
    );
    // Mocked defensively for tests that override portfolio to return data
    await authenticatedPage.route('**/api/snaptrade/portfolio/snapshots', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/snaptrade/recurring-investments', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/snaptrade/dividend-income', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { accounts: [], symbols: [], totals: [] } }) })
    );
  });

  test('renders Portfolio page kicker', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio');
    await expect(page.locator('.page-kicker')).toHaveText('Portfolio');
  });

  test('shows My Portfolio heading when no portfolio connected', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio');
    await expect(page.getByRole('heading', { level: 1, name: 'My Portfolio' })).toBeVisible();
  });

  test('shows empty state and Connect button when no portfolio', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio');
    await expect(page.getByText('No Portfolio Found')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect Brokerage Account' })).toBeVisible();
  });

  test('shows formatted balance in heading when portfolio has data', async ({ authenticatedPage: page }) => {
    await page.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_PORTFOLIO_EMPTY }) })
    );
    await page.goto('/portfolio');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('15,000');
  });

  test('shows Refresh and Future buttons when portfolio has data', async ({ authenticatedPage: page }) => {
    await page.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_PORTFOLIO_EMPTY }) })
    );
    await page.goto('/portfolio');
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Future' })).toBeVisible();
  });

  test('Refresh button calls portfolio API again', async ({ authenticatedPage: page }) => {
    await page.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false }) })
    );
    await page.goto('/portfolio');
    const refreshResp = page.waitForResponse(
      (resp) => resp.url().includes('/snaptrade/portfolio') && !resp.url().includes('snapshots') && resp.request().method() === 'GET'
    );
    await page.getByRole('button', { name: 'Refresh' }).click();
    await refreshResp;
  });

  test('shows account card when portfolio has accounts', async ({ authenticatedPage: page }) => {
    await page.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_PORTFOLIO_WITH_ACCOUNT }) })
    );
    await page.goto('/portfolio');
    await expect(page.getByRole('heading', { level: 3, name: 'Robinhood' })).toBeVisible();
    await expandRobinhoodAccounts(page);
    // Use .account-info h3 to avoid matching the company group heading on the page.
    await expect(page.locator('.account-info h3').filter({ hasText: 'Robinhood' })).toBeVisible();
    // Target the actual button element by aria-label because the parent div also has role="button".
    await expect(page.locator('button[aria-label="Rename account"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Remove account"]')).toBeVisible();
  });

  test('Rename account button opens nickname input', async ({ authenticatedPage: page }) => {
    await page.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_PORTFOLIO_WITH_ACCOUNT }) })
    );
    await page.goto('/portfolio');
    await expandRobinhoodAccounts(page);
    await page.locator('button[aria-label="Rename account"]').click();
    await expect(page.locator('input[placeholder="Robinhood"]')).toBeVisible();
    await expect(page.locator('.account-preferences').getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.locator('.account-preferences').getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('Remove account calls DELETE after confirm dialog', async ({ authenticatedPage: page }) => {
    await page.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_PORTFOLIO_WITH_ACCOUNT }) })
    );
    await page.route('**/api/snaptrade/accounts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { accountId: 'acc-test-id', hidden: true } }) })
    );
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('/portfolio');
    await expandRobinhoodAccounts(page);

    const deleteResp = page.waitForResponse(
      (resp) => resp.url().includes('/snaptrade/accounts') && resp.request().method() === 'DELETE'
    );
    await page.locator('button[aria-label="Remove account"]').click();
    await deleteResp;
  });

  test('Future button toggles projected portfolio panel', async ({ authenticatedPage: page }) => {
    await page.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_PORTFOLIO_EMPTY }) })
    );
    await page.goto('/portfolio');
    await page.getByRole('button', { name: 'Future' }).click();
    await expect(page.getByText('Projected Portfolio')).toBeVisible();
  });
});
