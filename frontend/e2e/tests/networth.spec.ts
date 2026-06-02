import { test, expect } from '../fixtures/auth.fixture';

const MOCK_PORTFOLIO = {
  totalBalance: 10_000.0,
  allTimeGainLoss: 1_500.0,
  allTimeGainLossPercent: 17.65,
  accounts: [],
  holdings: [],
};

const MOCK_ASSET = {
  id: 'asset-1',
  name: 'My House',
  assetType: 'Real Estate',
  value: 500_000,
  institution: 'Chase',
  notes: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

test.describe('Net Worth', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Global mocks required for every authenticated page (nav, watchlist service)
    await authenticatedPage.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/assets', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
    await authenticatedPage.route('**/api/loans', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
    await authenticatedPage.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_PORTFOLIO }),
      })
    );
  });

  test('renders page with Balance sheet kicker', async ({ authenticatedPage: page }) => {
    await page.goto('/networth');
    await expect(page.locator('.page-kicker')).toHaveText('Balance sheet');
    await expect(page.locator('.totals-card')).toBeVisible();
  });

  test('shows Add Asset button when no assets exist', async ({ authenticatedPage: page }) => {
    await page.goto('/networth');
    await expect(page.getByRole('button', { name: 'Add Asset' }).first()).toBeVisible();
  });

  test('Add Asset button opens the asset form', async ({ authenticatedPage: page }) => {
    await page.goto('/networth');
    await page.getByRole('button', { name: 'Add Asset' }).first().click();
    await expect(page.locator('#assetName')).toBeVisible();
    await expect(page.locator('#assetType')).toBeVisible();
    await expect(page.locator('#assetValue')).toBeVisible();
  });

  test('Save Asset button is disabled when form is invalid', async ({ authenticatedPage: page }) => {
    await page.goto('/networth');
    await page.getByRole('button', { name: 'Add Asset' }).first().click();
    await expect(page.getByRole('button', { name: 'Save Asset' })).toBeDisabled();
  });

  test('creates an asset and closes the form', async ({ authenticatedPage: page }) => {
    await page.route('**/api/assets', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_ASSET }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      }
    });
    await page.goto('/networth');
    await page.getByRole('button', { name: 'Add Asset' }).first().click();

    await page.locator('#assetName').fill('My House');
    await page.locator('#assetType').selectOption('Real Estate');
    await page.locator('#assetValue').fill('500000');

    const saveResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/assets') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Save Asset' }).click();
    await saveResp;

    await expect(page.locator('#assetName')).not.toBeVisible();
  });

  test('shows existing asset cards', async ({ authenticatedPage: page }) => {
    await page.route('**/api/assets', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_ASSET] }),
      })
    );
    await page.goto('/networth');
    await expect(page.locator('.loan-item').filter({ hasText: 'My House' })).toBeVisible();
    await expect(page.getByText('Real Estate')).toBeVisible();
  });

  test('Delete button removes an asset', async ({ authenticatedPage: page }) => {
    let deleted = false;
    await page.route('**/api/assets', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: deleted ? [] : [MOCK_ASSET] }),
      })
    );
    await page.route('**/api/assets/**', (route) => {
      deleted = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.goto('/networth');
    const houseCard = page.locator('.loan-item').filter({ hasText: 'My House' });
    await expect(houseCard).toBeVisible();

    const deleteResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/assets/asset-1') && resp.request().method() === 'DELETE'
    );
    await houseCard.getByRole('button', { name: 'Delete' }).click();
    await deleteResp;

    await expect(houseCard).not.toBeVisible();
  });
});
