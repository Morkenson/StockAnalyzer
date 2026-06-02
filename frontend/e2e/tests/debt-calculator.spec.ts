import { test, expect } from '../fixtures/auth.fixture';

const MOCK_LOAN = {
  id: 'loan-test-id',
  name: 'Car Loan',
  principal: 10_000,
  interestRate: 5.5,
  loanTerm: 60,
  monthlyPayment: 191.01,
  totalAmountPaid: 11_460.6,
  totalInterest: 1_460.6,
  notes: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

test.describe('Debt Calculator', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    // LoanService loads loans on auth — return empty list by default
    await authenticatedPage.route('**/api/loans', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
  });

  test('renders Planning page kicker and Debt Calculator heading', async ({ authenticatedPage: page }) => {
    await page.goto('/networth/debt');
    await expect(page.locator('.page-kicker')).toHaveText('Planning');
    await expect(page.getByRole('heading', { level: 1, name: 'Debt Calculator' })).toBeVisible();
  });

  test('shows empty state when no loans saved', async ({ authenticatedPage: page }) => {
    await page.goto('/networth/debt');
    await expect(page.getByText('No loans yet.')).toBeVisible();
  });

  test('Add Loan button shows the loan form', async ({ authenticatedPage: page }) => {
    await page.goto('/networth/debt');
    // Target the hero-section Add Loan button to avoid the duplicate in saved-loans section
    await page.locator('.debt-hero').getByRole('button', { name: 'Add Loan' }).click();
    await expect(page.locator('#principal')).toBeVisible();
    await expect(page.locator('#interestRate')).toBeVisible();
    await expect(page.locator('#loanTerm')).toBeVisible();
  });

  test('Calculate Payment button is disabled when form is invalid', async ({ authenticatedPage: page }) => {
    await page.goto('/networth/debt');
    await page.locator('.debt-hero').getByRole('button', { name: 'Add Loan' }).click();
    await expect(page.getByRole('button', { name: 'Calculate Payment' })).toBeDisabled();
  });

  test('calculates monthly payment and shows Payment Summary', async ({ authenticatedPage: page }) => {
    await page.goto('/networth/debt');
    await page.locator('.debt-hero').getByRole('button', { name: 'Add Loan' }).click();
    await page.locator('#principal').fill('10000');
    await page.locator('#interestRate').fill('5.5');
    await page.locator('#loanTerm').fill('60');
    await page.getByRole('button', { name: 'Calculate Payment' }).click();
    await expect(page.getByText('Payment Summary')).toBeVisible();
    await expect(page.locator('.result-label', { hasText: 'Monthly Payment' })).toBeVisible();
  });

  test('shows saved loans list when loans exist', async ({ authenticatedPage: page }) => {
    await page.route('**/api/loans', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [MOCK_LOAN] }) })
    );
    await page.goto('/networth/debt');
    await expect(page.locator('.loan-item').filter({ hasText: 'Car Loan' })).toBeVisible();
    await expect(page.getByText('5.5%')).toBeVisible();
  });

  test('Delete loan calls DELETE API after confirm dialog', async ({ authenticatedPage: page }) => {
    let deleted = false;
    await page.route('**/api/loans', (route) => {
      if (route.request().method() === 'DELETE') {
        deleted = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: deleted ? [] : [MOCK_LOAN] }) });
      }
    });
    await page.route('**/api/loans/**', (route) => {
      deleted = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('/networth/debt');

    const deleteResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/loans/') && resp.request().method() === 'DELETE'
    );
    await page.locator('.loan-item').filter({ hasText: 'Car Loan' }).getByRole('button', { name: 'Delete' }).click();
    await deleteResp;
  });

  test('shows Loan Snapshot totals section', async ({ authenticatedPage: page }) => {
    await page.goto('/networth/debt');
    await expect(page.getByText('Loan Snapshot')).toBeVisible();
    await expect(page.getByText('Total Monthly Payments')).toBeVisible();
  });
});
