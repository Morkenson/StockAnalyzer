import { test, expect } from '../fixtures/auth.fixture';

const MARKET_QUOTES = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 540.12, change: 1.23, changePercent: 0.23 },
  { symbol: 'QQQ', name: 'Invesco QQQ ETF', price: 460.55, change: -0.88, changePercent: -0.19 },
  { symbol: 'BTC/USD', name: 'Bitcoin', price: 67200.0, change: 1200.0, changePercent: 1.82 },
];

const MOCK_WATCHLIST = {
  id: 'wl-test-id',
  name: 'My Watchlist',
  description: null,
  isDefault: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

test.describe('Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Stock quotes endpoint (used for market indexes and watchlist stocks)
    await authenticatedPage.route('**/api/stock/quotes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MARKET_QUOTES }),
      })
    );
    // Watchlist list — return one default watchlist to prevent the service from calling POST /api/watchlists
    await authenticatedPage.route('**/api/watchlists', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_WATCHLIST] }),
      })
    );
    // Watchlist items — empty by default; individual tests override this
    await authenticatedPage.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
  });

  test('renders hero section with branding', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('.page-kicker')).toHaveText('Mork Wealth');
    await expect(page.locator('h1')).toContainText('Investing, simplified.');
  });

  test('shows Search Stocks and View Watchlists CTA buttons', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    // Two "Search Stocks" buttons exist (hero + empty-watchlist state); check the first
    await expect(page.getByRole('button', { name: 'Search Stocks' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Watchlists' })).toBeVisible();
  });

  test('Search Stocks button navigates to /search', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Search Stocks' }).first().click();
    await expect(page).toHaveURL('/search');
  });

  test('View Watchlists button navigates to /watchlist', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'View Watchlists' }).click();
    await expect(page).toHaveURL('/watchlist');
  });

  test('shows market indexes when data loads', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Markets', { exact: true })).toBeVisible();
    await expect(page.getByText('SPY')).toBeVisible();
    await expect(page.getByText('QQQ')).toBeVisible();
    await expect(page.getByText('BTC/USD')).toBeVisible();
  });

  test('shows empty watchlist state when watchlist is empty', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Your watchlist is empty')).toBeVisible();
    await expect(page.getByText('Start tracking stocks by adding them from search.')).toBeVisible();
  });

  test('shows watchlist stocks when watchlist has items', async ({ authenticatedPage: page }) => {
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
    await page.unroute('**/api/stock/quotes');
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            ...MARKET_QUOTES,
            { symbol: 'AAPL', name: 'Apple Inc.', price: 195.0, change: 2.5, changePercent: 1.3 },
          ],
        }),
      })
    );

    await page.goto('/dashboard');
    await expect(page.getByText('AAPL')).toBeVisible();
  });
});

test.describe('Dashboard — API error states', () => {
  test('handles market data API failure gracefully', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Internal server error' }),
      })
    );
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_WATCHLIST] }),
      })
    );
    await page.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    // Page should load without crashing
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Investing, simplified.');
  });
});
