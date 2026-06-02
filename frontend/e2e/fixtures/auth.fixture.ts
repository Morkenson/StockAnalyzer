import { test as base, Page } from '@playwright/test';

const MOCK_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  createdAt: '2025-01-01T00:00:00Z',
};

/**
 * Sets up an authenticated session by:
 * 1. Injecting the user into localStorage via addInitScript (runs before Angular bootstraps,
 *    so the auth service reads it synchronously before the guard fires)
 * 2. Mocking /api/auth/me so the async validation also succeeds
 */
async function mockAuthenticatedSession(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem('stock_analyzer_user', JSON.stringify(user));
  }, MOCK_USER);

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { user: MOCK_USER } }),
    })
  );
}

/**
 * Intercepts /api/auth/me to return unauthenticated (401), simulating a logged-out state.
 */
async function mockUnauthenticatedSession(page: Page): Promise<void> {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Unauthorized' }),
    })
  );
}

export type AuthFixtures = {
  authenticatedPage: Page;
  unauthenticatedPage: Page;
  mockUser: typeof MOCK_USER;
};

export const test = base.extend<AuthFixtures>({
  mockUser: [MOCK_USER, { option: true }],

  authenticatedPage: async ({ page }, use) => {
    await mockAuthenticatedSession(page);
    await use(page);
  },

  unauthenticatedPage: async ({ page }, use) => {
    await mockUnauthenticatedSession(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
