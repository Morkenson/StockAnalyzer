import { test, expect } from '../fixtures/auth.fixture';

const MOCK_ENTRIES = [
  {
    id: 'entry-1',
    type: 'income',
    name: 'Salary',
    category: 'Employment',
    amount: 5000,
    date: '2025-01-15',
    source: 'manual',
  },
  {
    id: 'entry-2',
    type: 'expense',
    name: 'Rent',
    category: 'Housing',
    amount: 1500,
    date: '2025-01-01',
    source: 'manual',
  },
];

test.describe('Income & Expenses', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Global mocks required for every authenticated page (nav, watchlist service)
    await authenticatedPage.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    // Mock plaid auto-sync called on init (loadPage(true) → syncPlaid(true))
    await authenticatedPage.route('**/api/plaid/sync**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { itemsSynced: 0, transactionsSynced: 0 } }),
      })
    );
    await authenticatedPage.route('**/api/cashflow/entries**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
    await authenticatedPage.route('**/api/plaid/accounts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
  });

  test('renders page with Cashflow kicker', async ({ authenticatedPage: page }) => {
    await page.goto('/income-expenses');
    await expect(page.locator('.page-kicker')).toHaveText('Cashflow');
    await expect(page.getByRole('button', { name: 'Add Entry' })).toBeVisible();
  });

  test('Add Entry button opens the entry modal', async ({ authenticatedPage: page }) => {
    await page.goto('/income-expenses');
    await page.getByRole('button', { name: 'Add Entry' }).click();
    await expect(page.locator('.cashflow-entry-modal')).toBeVisible();
    await expect(page.locator('#cashflowName')).toBeVisible();
    await expect(page.locator('#cashflowCategory')).toBeVisible();
    await expect(page.locator('#cashflowAmount')).toBeVisible();
    await expect(page.locator('#cashflowDate')).toBeVisible();
  });

  test('entry type toggle switches between Income and Expense', async ({ authenticatedPage: page }) => {
    await page.goto('/income-expenses');
    await page.getByRole('button', { name: 'Add Entry' }).click();
    const toggle = page.locator('.cashflow-type-toggle');
    await expect(toggle.getByRole('button', { name: 'Income' })).toBeVisible();
    await expect(toggle.getByRole('button', { name: 'Expense' })).toBeVisible();
    await toggle.getByRole('button', { name: 'Expense' }).click();
    await toggle.getByRole('button', { name: 'Income' }).click();
  });

  test('submit is disabled when form is empty', async ({ authenticatedPage: page }) => {
    await page.goto('/income-expenses');
    await page.getByRole('button', { name: 'Add Entry' }).click();
    await expect(page.locator('.modal-content').getByRole('button', { name: 'Add Entry', exact: true })).toBeDisabled();
  });

  test('shows entries in table', async ({ authenticatedPage: page }) => {
    await page.route(/\/api\/cashflow\/entries/, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_ENTRIES }),
        });
      } else {
        route.continue();
      }
    });
    await page.goto('/income-expenses');
    await expect(page.getByRole('cell', { name: 'Salary' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Rent' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Employment' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Housing' })).toBeVisible();
  });

  test('creates a new entry and it appears in the table', async ({ authenticatedPage: page }) => {
    const newEntry = { id: 'entry-new', type: 'income', name: 'Bonus', category: 'Employment', amount: 2000, date: '2025-01-20', source: 'manual' };
    await page.route(/\/api\/cashflow\/entries/, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: newEntry }),
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [newEntry] }),
        });
      } else {
        route.continue();
      }
    });
    await page.goto('/income-expenses');
    await page.getByRole('button', { name: 'Add Entry' }).click();

    await page.locator('#cashflowName').fill('Bonus');
    await page.locator('#cashflowCategory').fill('Employment');
    await page.locator('#cashflowAmount').fill('2000');
    await page.locator('#cashflowDate').fill('2025-01-20');

    const createResp = page.waitForResponse(
      (resp) => resp.url().includes('/cashflow/entries') && resp.request().method() === 'POST'
    );
    await page.locator('.modal-content').getByRole('button', { name: 'Add Entry', exact: true }).click();
    await createResp;

    await expect(page.locator('.cashflow-entry-modal')).not.toBeVisible();
    await expect(page.getByText('Bonus')).toBeVisible();
  });

  test('Delete button removes an entry', async ({ authenticatedPage: page }) => {
    let deleted = false;
    await page.route(/\/api\/cashflow\/entries/, (route) => {
      if (route.request().method() === 'DELETE') {
        deleted = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: deleted ? [] : MOCK_ENTRIES }),
        });
      } else {
        route.continue();
      }
    });
    await page.goto('/income-expenses');
    await expect(page.getByRole('cell', { name: 'Salary' })).toBeVisible();

    const deleteResp = page.waitForResponse(
      (resp) => resp.url().includes('/cashflow/entries') && resp.request().method() === 'DELETE'
    );
    await page.locator('tr').filter({ hasText: 'Salary' }).getByRole('button', { name: 'Delete' }).click();
    await deleteResp;

    await expect(page.getByRole('cell', { name: 'Salary' })).not.toBeVisible();
  });
});
