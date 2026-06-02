import { test, expect } from '../fixtures/auth.fixture';

const MOCK_WATCHLIST = {
  id: 'wl-test-id',
  name: 'My Watchlist',
  description: null,
  isDefault: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const MOCK_SECOND_WATCHLIST = {
  id: 'wl-second-id',
  name: 'Tech Stocks',
  description: 'My tech picks',
  isDefault: false,
  createdAt: '2025-01-02T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
};

const MOCK_AAPL_ITEM = {
  id: 'item-1',
  symbol: 'AAPL',
  notes: null,
  addedDate: '2025-01-01T00:00:00Z',
};

const MOCK_AAPL_QUOTE = {
  symbol: 'AAPL',
  price: 195.0,
  change: 2.5,
  changePercent: 1.3,
  volume: 55_000_000,
};

test.describe('Watchlist', () => {
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
    await authenticatedPage.route('**/api/stock/quotes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
  });

  test('renders watchlist selector and management buttons', async ({ authenticatedPage: page }) => {
    await page.goto('/watchlist');
    await expect(page.locator('.watchlist-select')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    // Delete is only shown for non-default watchlists
  });

  test('shows empty state with Search Stocks button when watchlist is empty', async ({ authenticatedPage: page }) => {
    await page.goto('/watchlist');
    await expect(page.getByRole('button', { name: 'Search Stocks' })).toBeVisible();
  });

  test('shows stock rows when watchlist has items', async ({ authenticatedPage: page }) => {
    await page.unroute('**/api/watchlists/*/items');
    await page.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_AAPL_ITEM] }),
      })
    );
    await page.unroute('**/api/stock/quotes');
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_AAPL_QUOTE] }),
      })
    );
    await page.goto('/watchlist');
    await expect(page.getByText('AAPL')).toBeVisible();
    await expect(page.getByText('195')).toBeVisible();
  });

  test('New button opens Create Watchlist modal', async ({ authenticatedPage: page }) => {
    await page.goto('/watchlist');
    await page.getByRole('button', { name: 'New' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.getByText('Create New Watchlist')).toBeVisible();
  });

  test('Create button is disabled when watchlist name is empty', async ({ authenticatedPage: page }) => {
    await page.goto('/watchlist');
    await page.getByRole('button', { name: 'New' }).click();
    await expect(page.locator('.modal-content').getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  test('creates new watchlist and closes modal', async ({ authenticatedPage: page }) => {
    await page.route('**/api/watchlists', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_SECOND_WATCHLIST }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [MOCK_WATCHLIST, MOCK_SECOND_WATCHLIST] }),
        });
      }
    });
    await page.goto('/watchlist');
    await page.getByRole('button', { name: 'New' }).click();
    await page.locator('input[placeholder="e.g., Tech Stocks"]').fill('Tech Stocks');

    const createResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/watchlists') && resp.request().method() === 'POST'
    );
    await page.locator('.modal-content').getByRole('button', { name: 'Create' }).click();
    await createResp;

    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('Edit button opens Edit Watchlist modal pre-filled with current name', async ({ authenticatedPage: page }) => {
    await page.goto('/watchlist');
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.getByText('Edit Watchlist')).toBeVisible();
    await expect(page.locator('input[placeholder="Watchlist name"]')).toHaveValue('My Watchlist');
  });

  test('deletes non-default watchlist on Delete button click', async ({ authenticatedPage: page }) => {
    // Delete button only renders when selectedWatchlist.isDefault === false
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_SECOND_WATCHLIST] }),
      })
    );
    await page.route('**/api/watchlists/wl-second-id', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    // deleteWatchlist() shows a confirm dialog before calling the API
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('/watchlist');
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

    const deleteResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/watchlists/wl-second-id') && resp.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Delete' }).click();
    await deleteResp;
  });

  test('Remove button deletes stock from watchlist', async ({ authenticatedPage: page }) => {
    await page.unroute('**/api/watchlists/*/items');
    await page.route('**/api/watchlists/*/items', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [MOCK_AAPL_ITEM] }),
        });
      }
    });
    await page.unroute('**/api/stock/quotes');
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_AAPL_QUOTE] }),
      })
    );
    await page.goto('/watchlist');
    await expect(page.getByText('AAPL')).toBeVisible();

    const removeResp = page.waitForResponse(
      (resp) => resp.url().includes('/items') && resp.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Remove AAPL from watchlist' }).click();
    await removeResp;

    await expect(page.getByText('AAPL')).not.toBeVisible();
  });
});
