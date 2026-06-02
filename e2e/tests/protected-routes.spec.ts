import { test, expect } from '../fixtures/auth.fixture';

const PROTECTED_ROUTES = [
  '/dashboard',
  '/search',
  '/watchlist',
  '/portfolio',
  '/networth',
  '/income-expenses',
  '/settings',
];

test.describe('Auth guard — unauthenticated redirects', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`redirects ${route} to /login when not authenticated`, async ({ unauthenticatedPage: page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('preserves returnUrl query param on redirect', async ({ unauthenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/returnUrl=%2Fdashboard/);
  });
});

test.describe('Auth guard — authenticated access', () => {
  test('allows access to /dashboard when authenticated', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL('/dashboard');
  });

  test('redirects authenticated user away from /login to /dashboard', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await page.goto('/login');
    await expect(page).toHaveURL('/dashboard');
  });

  test('redirects authenticated user away from /signup to /dashboard', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await page.goto('/signup');
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Navigation header', () => {
  test('shows nav links when authenticated', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );

    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Watchlist' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Portfolio' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Net Worth' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Income' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Debt' })).toBeVisible();
  });

  test('header search is visible when authenticated', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );

    await page.goto('/dashboard');
    await expect(page.getByPlaceholder('Search stocks...')).toBeVisible();
  });
});
