import { test, expect } from '../fixtures/auth.fixture';

const MARKET_QUOTES = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 540.12, change: 1.23, changePercent: 0.23 },
  { symbol: 'QQQ', name: 'Invesco QQQ ETF', price: 460.55, change: -0.88, changePercent: -0.19 },
  { symbol: 'BTC/USD', name: 'Bitcoin', price: 67200.0, change: 1200.0, changePercent: 1.82 },
];

test.describe('Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/stocks/quotes*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MARKET_QUOTES }),
      })
    );
    await authenticatedPage.route('**/api/watchlist', (route) =>
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
    await expect(page.getByRole('button', { name: 'Search Stocks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Watchlists' })).toBeVisible();
  });

  test('Search Stocks button navigates to /search', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Search Stocks' }).click();
    await expect(page).toHaveURL('/search');
  });

  test('View Watchlists button navigates to /watchlist', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'View Watchlists' }).click();
    await expect(page).toHaveURL('/watchlist');
  });

  test('shows market indexes when data loads', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Markets')).toBeVisible();
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
    await page.unroute('**/api/watchlist');
    await page.route('**/api/watchlist', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ symbol: 'AAPL', name: 'Apple Inc.' }] }),
      })
    );
    await page.route('**/api/stocks/quotes*', (route) => {
      const url = route.request().url();
      if (url.includes('AAPL')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [{ symbol: 'AAPL', name: 'Apple Inc.', price: 195.0, change: 2.5, changePercent: 1.3 }],
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MARKET_QUOTES }),
      });
    });

    await page.goto('/dashboard');
    await expect(page.getByText('AAPL')).toBeVisible();
  });
});

test.describe('Dashboard — API error states', () => {
  test('handles market data API failure gracefully', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stocks/quotes*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Internal server error' }),
      })
    );
    await page.route('**/api/watchlist', (route) =>
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
