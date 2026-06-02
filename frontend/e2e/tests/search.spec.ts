import { test, expect } from '../fixtures/auth.fixture';

const MOCK_WATCHLIST = {
  id: 'wl-test-id',
  name: 'My Watchlist',
  description: null,
  isDefault: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const MOCK_SEARCH_RESULTS = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'Equity' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'Equity' },
];

const MOCK_STOCK_DETAILS = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  exchange: 'NASDAQ',
  currentPrice: 195.5,
  previousClose: 193.0,
  change: 2.5,
  changePercent: 1.3,
  volume: 55_000_000,
  description: 'Apple Inc. designs and manufactures consumer electronics.',
};

test.describe('Stock Search', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
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

  test('renders page with Explore kicker and search input', async ({ authenticatedPage: page }) => {
    await page.goto('/search');
    await expect(page.locator('.page-kicker')).toHaveText('Explore');
    await expect(page.locator('#searchInput')).toBeVisible();
  });

  test('shows results when searching', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_SEARCH_RESULTS }),
      })
    );
    await page.goto('/search');
    await page.locator('#searchInput').fill('AAPL');
    await expect(page.getByText('Apple Inc.')).toBeVisible();
    await expect(page.getByText('AMZN')).toBeVisible();
    await expect(page.getByText('NASDAQ').first()).toBeVisible();
  });

  test('shows no results message when search returns empty', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
    await page.goto('/search');
    await page.locator('#searchInput').fill('ZZZNOTREAL');
    await expect(page.getByText('No results found')).toBeVisible();
  });

  test('clicking a result row navigates to stock detail page', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_SEARCH_RESULTS }),
      })
    );
    await page.route('**/api/stock/details/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_STOCK_DETAILS }),
      })
    );
    await page.route('**/api/stock/historical/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
    await page.goto('/search');
    await page.locator('#searchInput').fill('AAPL');
    await expect(page.getByText('Apple Inc.')).toBeVisible();
    await page.locator('.result-row').filter({ hasText: 'Apple Inc.' }).click();
    await expect(page).toHaveURL('/stock/AAPL');
  });

  test('Add button opens watchlist dropdown', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_SEARCH_RESULTS }),
      })
    );
    await page.goto('/search');
    await page.locator('#searchInput').fill('AAPL');
    await expect(page.getByText('Apple Inc.')).toBeVisible();
    await page.getByRole('button', { name: 'Add AAPL to watchlist' }).click();
    await expect(page.getByText('My Watchlist')).toBeVisible();
  });

  test('selecting a watchlist from the dropdown POSTs the stock to the watchlist', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_SEARCH_RESULTS }),
      })
    );
    await page.route('**/api/watchlists/*/items', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'item-new', symbol: 'AAPL', notes: null, addedDate: '2025-01-01T00:00:00Z' },
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      }
    });
    await page.goto('/search');
    await page.locator('#searchInput').fill('AAPL');
    await expect(page.getByText('Apple Inc.')).toBeVisible();

    const addResp = page.waitForResponse(
      (resp) => resp.url().includes('/items') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Add AAPL to watchlist' }).click();
    await page.getByRole('button', { name: 'Add AAPL to My Watchlist' }).click();
    const resp = await addResp;
    expect(resp.status()).toBe(201);
  });
});
