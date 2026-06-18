import { test, expect } from '../fixtures/auth.fixture';

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

const MOCK_PORTFOLIO = {
  totalBalance: 15_000.0,
  totalGainLoss: 1_500.0,
  totalGainLossPercent: 11.11,
  accounts: [MOCK_ACCOUNT],
  holdings: [],
};

test.describe('Account Detail', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_PORTFOLIO }) })
    );
    await authenticatedPage.route('**/api/snaptrade/accounts/*/snapshots', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    // Account snapshots are mocked above so balance history cannot fall through to a real API.
    await authenticatedPage.route('**/api/snaptrade/recurring-investments', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/snaptrade/recurring-buys', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/snaptrade/dividend-income', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { accounts: [], symbols: [], totals: [] } }) })
    );
  });

  test('renders account name as heading', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-test-id');
    await expect(page.getByRole('heading', { level: 1, name: 'Robinhood' })).toBeVisible();
  });

  test('shows Portfolio back button', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-test-id');
    await expect(page.getByRole('button', { name: /Portfolio/ })).toBeVisible();
  });

  test('shows Rename, Remove, and Future buttons', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-test-id');
    await expect(page.getByRole('button', { name: 'Rename' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Future' })).toBeVisible();
  });

  test('shows Balance History chart range tabs', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-test-id');
    for (const label of ['1W', '1M', '3M', '1Y', '5Y', 'All']) {
      await expect(page.locator('.chart-range-tab').filter({ hasText: label })).toBeVisible();
    }
  });

  test('shows Account Not Found for unknown account ID', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/nonexistent-id');
    await expect(page.getByText('Account Not Found')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Portfolio' })).toBeVisible();
  });

  test('Rename button opens nickname input', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-test-id');
    // Scope to header-actions to avoid ambiguity with Save/Cancel in other sections
    await page.locator('.header-actions').getByRole('button', { name: 'Rename' }).click();
    await expect(page.locator('.account-preferences').getByRole('textbox')).toBeVisible();
    await expect(page.locator('.account-preferences').getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.locator('.account-preferences').getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('Holdings section toggle expands to show holdings table', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-test-id');
    // Section starts collapsed
    await expect(page.locator('#account-holdings-section')).not.toBeVisible();
    // Click the holdings toggle button
    await page.getByRole('button', { name: /Holdings/ }).click();
    await expect(page.locator('#account-holdings-section')).toBeVisible();
  });

  test('Remove account calls DELETE after confirm dialog', async ({ authenticatedPage: page }) => {
    await page.route('**/api/snaptrade/accounts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { accountId: 'acc-test-id', hidden: true } }) })
    );
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('/portfolio/accounts/acc-test-id');

    const deleteResp = page.waitForResponse(
      (resp) => resp.url().includes('/snaptrade/accounts') && resp.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Remove' }).click();
    await deleteResp;
  });

  test('hides recurring-buy setup for a read-only brokerage', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-test-id');
    await page.locator('.recurring-card-header').click();
    await expect(page.locator('#account-recurring-section')).toBeVisible();
    await expect(page.getByRole('button', { name: /Set up recurring buy/ })).toHaveCount(0);
    await expect(page.getByText('This connection is read-only')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable trading' })).toBeVisible();
  });
});

const TRADE_ACCOUNT = {
  id: 'acc-trade-id',
  name: 'Webull',
  nickname: null,
  accountNumber: '****9999',
  type: 'INDIVIDUAL',
  currency: 'USD',
  brokerageId: 'WEBULL',
  balance: 5_000.0,
  holdings: [],
  marginBalance: null,
  marginInterestRate: null,
  supportsTrading: true,
};

const TRADE_PORTFOLIO = {
  totalBalance: 5_000.0,
  totalGainLoss: 0,
  totalGainLossPercent: 0,
  accounts: [TRADE_ACCOUNT],
  holdings: [],
};

const fulfillJson = (route: import('@playwright/test').Route, data: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

test.describe('Account Detail — recurring buys (trade-enabled)', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/watchlists', (route) => fulfillJson(route, []));
    await authenticatedPage.route('**/api/watchlists/*/items', (route) => fulfillJson(route, []));
    await authenticatedPage.route('**/api/snaptrade/portfolio', (route) => fulfillJson(route, TRADE_PORTFOLIO));
    await authenticatedPage.route('**/api/snaptrade/accounts/*/snapshots', (route) => fulfillJson(route, []));
    await authenticatedPage.route('**/api/snaptrade/recurring-investments', (route) => fulfillJson(route, []));
    await authenticatedPage.route('**/api/snaptrade/dividend-income', (route) =>
      fulfillJson(route, { accounts: [], symbols: [], totals: [] })
    );
    // GET lists schedules; POST creates one — same URL, branch on method.
    await authenticatedPage.route('**/api/snaptrade/recurring-buys', (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        return fulfillJson(route, {
          id: 'rb-new',
          accountId: body.accountId,
          symbol: body.symbol,
          units: body.units ?? null,
          targetAmount: body.targetAmount ?? null,
          accumulatedBudget: 0,
          frequency: body.frequency,
          nextRunDate: '2026-06-15',
          lastRunDate: null,
          lastStatus: null,
          lastOrderId: null,
          active: true,
        });
      }
      return fulfillJson(route, []);
    });
    // Stock search + quotes use query strings, so match with regex.
    await authenticatedPage.route(/\/api\/stock\/search/, (route) =>
      fulfillJson(route, [{ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'stock' }])
    );
    await authenticatedPage.route(/\/api\/stock\/quotes/, (route) =>
      fulfillJson(route, [{ symbol: 'AAPL', price: 150, change: 0, changePercent: 0, volume: 0, timestamp: new Date().toISOString() }])
    );
  });

  test('shows the Set up recurring buy button for a trade-enabled brokerage', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-trade-id');
    await page.locator('.recurring-card-header').click();
    await expect(page.getByRole('button', { name: /Set up recurring buy/ })).toBeVisible();
  });

  test('opens the recurring buy modal', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-trade-id');
    await page.locator('.recurring-card-header').click();
    await page.getByRole('button', { name: /Set up recurring buy/ }).click();
    await expect(page.getByRole('heading', { name: 'Set up recurring buy' })).toBeVisible();
    // Dollar mode toggle reveals the dollar target input.
    await page.getByRole('button', { name: 'Dollar amount' }).click();
    await expect(page.getByLabel('Dollar target per buy')).toBeVisible();
  });

  test('creates a recurring buy after searching and selecting a stock', async ({ authenticatedPage: page }) => {
    await page.goto('/portfolio/accounts/acc-trade-id');
    await page.locator('.recurring-card-header').click();
    await page.getByRole('button', { name: /Set up recurring buy/ }).click();

    await page.getByLabel('Search for a stock').fill('AAPL');
    await page.locator('.symbol-search-result').filter({ hasText: 'AAPL' }).first().click();
    await expect(page.locator('.symbol-selected')).toContainText('AAPL');

    const createResp = page.waitForResponse(
      (resp) => resp.url().includes('/snaptrade/recurring-buys') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Create recurring buy' }).click();
    await createResp;

    await expect(page.getByRole('heading', { name: 'Set up recurring buy' })).toBeHidden();
    await expect(page.getByRole('cell', { name: 'AAPL' }).first()).toBeVisible();
  });
});
