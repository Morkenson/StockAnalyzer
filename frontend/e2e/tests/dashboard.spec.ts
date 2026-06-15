import { test, expect } from '../fixtures/auth.fixture';

const MARKET_QUOTES = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 540.12, change: 1.23, changePercent: 0.23 },
  { symbol: 'QQQ', name: 'Invesco QQQ ETF', price: 460.55, change: -0.88, changePercent: -0.19 },
  { symbol: 'BTC/USD', name: 'Bitcoin', price: 67200.0, change: 1200.0, changePercent: 1.82 },
];

const PORTFOLIO = {
  userId: 'user-1',
  totalBalance: 125000,
  totalGainLoss: 4200,
  totalGainLossPercent: 3.48,
  currency: 'USD',
  accounts: [
    {
      id: 'acct-1',
      accountNumber: '1234',
      name: 'Fidelity',
      type: 'CASH',
      brokerageId: 'fidelity',
      balance: 125000,
      currency: 'USD',
      holdings: [
        { id: 'h-1', symbol: 'AAPL', quantity: 10, averagePurchasePrice: 150, currentPrice: 190, totalValue: 1900, bookValue: 1500, gainLoss: 400, gainLossPercent: 26.67, currency: 'USD' },
        { id: 'h-2', symbol: 'MSFT', quantity: 5, averagePurchasePrice: 300, currentPrice: 410, totalValue: 2050, bookValue: 1500, gainLoss: 550, gainLossPercent: 36.67, currency: 'USD' },
      ],
    },
  ],
};

test.describe('Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/stock/quotes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MARKET_QUOTES }),
      })
    );
    await authenticatedPage.route('**/api/snaptrade/portfolio', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: PORTFOLIO }),
      })
    );
    await authenticatedPage.route('**/api/assets', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'asset-1', name: 'Emergency Fund', assetType: 'Cash', value: 10000, institution: 'Bank', notes: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
          ],
        }),
      })
    );
    await authenticatedPage.route('**/api/loans', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'loan-1', name: 'Car', principal: 15000, interestRate: 6, loanTerm: 48, monthlyPayment: 352, totalAmountPaid: 16896, totalInterest: 1896, notes: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
          ],
        }),
      })
    );
    await authenticatedPage.route('**/api/cashflow/entries**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'entry-1', source: 'manual', type: 'income', name: 'Paycheck', category: 'Pay', amount: 6000, date: '2026-06-01', pending: false, createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z' },
            { id: 'entry-2', source: 'manual', type: 'expense', name: 'Rent', category: 'Housing', amount: 1800, date: '2026-06-02', pending: false, createdAt: '2026-06-02T00:00:00Z', updatedAt: '2026-06-02T00:00:00Z' },
          ],
        }),
      })
    );
    await authenticatedPage.route('**/api/real-estate/properties', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'property-1',
              name: 'Duplex',
              currency: 'USD',
              purchasePrice: 250000,
              downPaymentPct: 20,
              closingCosts: 5000,
              interestRate: 6.5,
              loanTermYears: 30,
              monthlyRent: 2600,
              vacancyRatePct: 5,
              propertyTaxAnnual: 3000,
              insuranceAnnual: 1200,
              hoaMonthly: 0,
              maintenancePct: 5,
              managementPct: 8,
              otherMonthlyCosts: 0,
              appreciationPct: 3,
              holdYears: 10,
              monthlyCashFlow: 325,
              capRate: 6.25,
              cashOnCashReturn: 7.1,
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      })
    );
  });

  test('renders hero section with branding', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('.page-kicker')).toHaveText('Mork Wealth');
    await expect(page.locator('h1')).toContainText('Investing, simplified.');
  });

  test('shows Search Stocks and View Portfolio CTA buttons', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: 'Search Stocks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Portfolio' })).toBeVisible();
  });

  test('Search Stocks button navigates to /search', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Search Stocks' }).click();
    await expect(page).toHaveURL('/search');
  });

  test('View Portfolio button navigates to /portfolio', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'View Portfolio' }).click();
    await expect(page).toHaveURL('/portfolio');
  });

  test('shows market indexes when data loads', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Markets', { exact: true })).toBeVisible();
    await expect(page.getByText('SPY')).toBeVisible();
    await expect(page.getByText('QQQ')).toBeVisible();
    await expect(page.getByText('BTC/USD')).toBeVisible();
  });

  test('shows information snapshots for the other app pages', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Financial Snapshots')).toBeVisible();
    await expect(page.getByText('$125,000')).toBeVisible();
    await expect(page.getByText('$120,000')).toBeVisible();
    await expect(page.getByText('+$4,200')).toBeVisible();
    await expect(page.getByText('1 property')).toBeVisible();
    await expect(page.getByText('$352')).toBeVisible();
    await expect(page.getByText('Account controls')).toBeVisible();
    await expect(page.getByText('Your watchlist is empty')).toHaveCount(0);
  });
});

test.describe('Dashboard API error states', () => {
  test('handles market data API failure gracefully', async ({ authenticatedPage: page }) => {
    await page.route('**/api/stock/quotes', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Internal server error' }),
      })
    );

    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Investing, simplified.');
  });
});
