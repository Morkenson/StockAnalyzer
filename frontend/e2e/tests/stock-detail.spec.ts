import { test, expect } from '../fixtures/auth.fixture';

const MOCK_WATCHLIST = {
  id: 'wl-test-id',
  name: 'My Watchlist',
  description: null,
  isDefault: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const MOCK_STOCK = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  exchange: 'NASDAQ',
  currentPrice: 195.5,
  previousClose: 193.0,
  change: 2.5,
  changePercent: 1.3,
  volume: 55_000_000,
  marketCap: 3_000_000_000_000,
  peRatio: 28.5,
  dividendYield: 0.52,
  high52Week: 220.0,
  low52Week: 164.0,
  averageVolume: 60_000_000,
  description: 'Apple Inc. designs and manufactures consumer electronics and software.',
};

test.describe('Stock Detail', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/stock/details/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_STOCK }),
      })
    );
    await authenticatedPage.route('**/api/stock/historical/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
    await authenticatedPage.route('**/api/watchlists', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_WATCHLIST] }),
      })
    );
    await authenticatedPage.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
  });

  test('renders stock symbol, name and price', async ({ authenticatedPage: page }) => {
    await page.goto('/stock/AAPL');
    await expect(page.getByText('AAPL').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Apple Inc.' })).toBeVisible();
    await expect(page.locator('.stock-price')).toBeVisible();
  });

  test('shows chart range tabs', async ({ authenticatedPage: page }) => {
    await page.goto('/stock/AAPL');
    for (const label of ['1D', '1W', '1M', '3M', '1Y', '5Y']) {
      await expect(page.locator('.chart-range-tab').filter({ hasText: label })).toBeVisible();
    }
  });

  test('clicking a chart range tab fetches new historical data', async ({ authenticatedPage: page }) => {
    await page.goto('/stock/AAPL');
    const historicalResp = page.waitForResponse((resp) =>
      resp.url().includes('/stock/historical/AAPL') && resp.request().method() === 'GET'
    );
    // Use CSS class selector since range tabs are inside a role="tablist"
    await page.locator('.chart-range-tab').filter({ hasText: '1Y' }).click();
    await historicalResp;
  });

  test('shows Add to Watchlist button when stock is not in watchlist', async ({ authenticatedPage: page }) => {
    await page.goto('/stock/AAPL');
    await expect(page.getByRole('button', { name: 'Add to Watchlist' })).toBeVisible();
  });

  test('Add to Watchlist button opens watchlist dropdown', async ({ authenticatedPage: page }) => {
    await page.goto('/stock/AAPL');
    await page.getByRole('button', { name: 'Add to Watchlist' }).click();
    await expect(page.getByText('My Watchlist')).toBeVisible();
  });

  test('shows Remove from Watchlist when stock is already in watchlist', async ({ authenticatedPage: page }) => {
    await page.unroute('**/api/watchlists/*/items');
    await page.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: 'item-1', symbol: 'AAPL', notes: null, addedDate: '2025-01-01T00:00:00Z' }],
        }),
      })
    );
    await page.goto('/stock/AAPL');
    await expect(page.getByRole('button', { name: 'Remove from Watchlist' })).toBeVisible();
  });

  test('Remove from Watchlist calls the DELETE endpoint', async ({ authenticatedPage: page }) => {
    // Use ** to match /items/AAPL (symbol is an extra path segment after /items)
    await page.route('**/api/watchlists/**', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [{ id: 'item-1', symbol: 'AAPL', notes: null, addedDate: '2025-01-01T00:00:00Z' }],
          }),
        });
      }
    });
    await page.goto('/stock/AAPL');
    await expect(page.getByRole('button', { name: 'Remove from Watchlist' })).toBeVisible();

    const removeResp = page.waitForResponse(
      (resp) => resp.url().includes('/items') && resp.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Remove from Watchlist' }).click();
    const resp = await removeResp;
    expect(resp.status()).toBe(200);
  });

  test('shows key metrics table', async ({ authenticatedPage: page }) => {
    await page.goto('/stock/AAPL');
    await expect(page.locator('.metrics-table')).toBeVisible();
    await expect(page.getByText('Market Cap')).toBeVisible();
    await expect(page.getByText('P/E Ratio')).toBeVisible();
  });

  test('shows stock description', async ({ authenticatedPage: page }) => {
    await page.goto('/stock/AAPL');
    await expect(page.getByText('Apple Inc. designs and manufactures consumer electronics')).toBeVisible();
  });
});
