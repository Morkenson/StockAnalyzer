import { test, expect } from '../fixtures/auth.fixture';
import { devices } from '@playwright/test';

// Mobile navigation: at a phone viewport the header collapses the nav links
// and search into a hamburger-toggled panel.
test.use({ ...devices['Pixel 5'] });

test.describe('Mobile navigation', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/quotes**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ id: 'wl1', name: 'My Watchlist', description: null, isDefault: true, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }] }) })
    );
    await page.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
  });

  test('hamburger toggles the nav panel', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');

    const toggle = page.locator('.menu-toggle');
    const watchlistLink = page.locator('.nav a', { hasText: 'Watchlist' });

    // Toggle is visible on mobile; nav links are hidden until opened.
    await expect(toggle).toBeVisible();
    await expect(watchlistLink).toBeHidden();

    await toggle.click();
    await expect(watchlistLink).toBeVisible();
  });

  test('selecting a nav link navigates and closes the menu', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');

    await page.locator('.menu-toggle').click();
    const watchlistLink = page.locator('.nav a', { hasText: 'Watchlist' });
    await expect(watchlistLink).toBeVisible();

    await watchlistLink.click();

    await expect(page).toHaveURL('/watchlist');
    // Menu collapses again after navigation.
    await expect(watchlistLink).toBeHidden();
  });
});
