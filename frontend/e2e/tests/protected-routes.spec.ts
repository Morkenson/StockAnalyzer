import { test, expect } from '../fixtures/auth.fixture';

const PROTECTED_ROUTES = [
  '/dashboard',
  '/search',
  '/watchlist',
  '/portfolio',
  '/networth',
  '/real-estate',
  '/income-expenses',
  '/taxes',
  '/settings',
];

const MOCK_WATCHLIST = {
  id: 'wl-test-id',
  name: 'My Watchlist',
  description: null,
  isDefault: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

/** Mocks all dashboard API calls so authenticated tests don't hit the real backend */
async function mockDashboardApis(page: ReturnType<typeof test.info> extends never ? never : any) {
  await page.route('**/api/stock/quotes', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
  await page.route('**/api/watchlists', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [MOCK_WATCHLIST] }) })
  );
  await page.route('**/api/watchlists/*/items', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
}

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
    await mockDashboardApis(page);
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL('/dashboard');
  });

  test('redirects authenticated user away from /login to /dashboard', async ({ authenticatedPage: page }) => {
    await mockDashboardApis(page);
    await page.goto('/login');
    await expect(page).toHaveURL('/dashboard');
  });

  test('redirects authenticated user away from /signup to /dashboard', async ({ authenticatedPage: page }) => {
    await mockDashboardApis(page);
    await page.goto('/signup');
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Navigation header', () => {
  test('shows nav links when authenticated', async ({ authenticatedPage: page }) => {
    await mockDashboardApis(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Watchlist' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Portfolio' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Net Worth' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Real Estate' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Income' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Taxes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  test('header search is visible when authenticated', async ({ authenticatedPage: page }) => {
    await mockDashboardApis(page);
    await page.goto('/dashboard');
    await expect(page.getByPlaceholder('Search stocks...')).toBeVisible();
  });
});
