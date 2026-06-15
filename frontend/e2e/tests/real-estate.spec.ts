import { test, expect } from '../fixtures/auth.fixture';

const MOCK_LISTING = {
  id: 'sample-lisbon-1',
  address: 'Rua dos Anjos 38',
  city: 'Lisbon',
  country: 'Portugal',
  propertyType: 'Apartment',
  price: 385000,
  currency: 'USD',
  bedrooms: 2,
  bathrooms: 1,
  areaSqm: 82,
  estimatedMonthlyRent: 1900,
  propertyTaxRatePct: 0.4,
  yearBuilt: 1972,
  source: 'sample',
};

const MOCK_PROPERTY = {
  id: 'property-test-id',
  name: 'Cleveland Duplex',
  address: '3315 Archwood Ave',
  city: 'Cleveland',
  country: 'United States',
  propertyType: 'Multi Family',
  currency: 'USD',
  purchasePrice: 152000,
  downPaymentPct: 20,
  closingCosts: 4500,
  interestRate: 6.5,
  loanTermYears: 30,
  monthlyRent: 1980,
  vacancyRatePct: 5,
  propertyTaxAnnual: 3344,
  insuranceAnnual: 900,
  hoaMonthly: 0,
  maintenancePct: 5,
  managementPct: 8,
  otherMonthlyCosts: 0,
  appreciationPct: 3,
  holdYears: 10,
  monthlyCashFlow: 446.6,
  capRate: 8.7,
  cashOnCashReturn: 15.3,
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_USAGE = {
  provider: 'rentcast',
  configured: false,
  used: 0,
  limit: 50,
  remaining: 50,
  periodStart: '2026-06-09',
  periodEnd: '2026-07-08',
};

test.describe('Real Estate', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    await authenticatedPage.route('**/api/watchlists/*/items', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    // RealEstateService loads saved properties on auth — return empty list by default
    await authenticatedPage.route('**/api/real-estate/properties', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
    // Search uses query params, so glob patterns won't match — use a regex
    await authenticatedPage.route(/\/api\/real-estate\/search/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { listings: [MOCK_LISTING], source: 'sample' } }),
      })
    );
    // Component loads RentCast quota usage on init
    await authenticatedPage.route('**/api/real-estate/usage', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_USAGE }),
      })
    );
  });

  test('renders Investing page kicker and Real Estate heading', async ({ authenticatedPage: page }) => {
    await page.goto('/real-estate');
    await expect(page.locator('.page-kicker')).toHaveText('Investing');
    await expect(page.getByRole('heading', { level: 1, name: 'Real Estate' })).toBeVisible();
  });

  test('header nav contains a Real Estate tab that routes to the page', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await page.locator('nav.nav').getByRole('link', { name: 'Real Estate' }).click();
    await expect(page).toHaveURL(/\/real-estate$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Real Estate' })).toBeVisible();
  });

  test('search shows listings with sample-data badge', async ({ authenticatedPage: page }) => {
    await page.goto('/real-estate');
    await page.locator('#location').fill('Lisbon');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.listing-card').filter({ hasText: 'Rua dos Anjos 38' })).toBeVisible();
    await expect(page.locator('.sample-badge')).toBeVisible();
    await expect(page.getByText('1 property found')).toBeVisible();
  });

  test('shows empty state when search has no matches', async ({ authenticatedPage: page }) => {
    await page.route(/\/api\/real-estate\/search/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { listings: [], source: 'sample' } }),
      })
    );
    await page.goto('/real-estate');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText('No properties matched your search.')).toBeVisible();
  });

  test('Analyze on a listing prefills the calculator and shows the analysis', async ({ authenticatedPage: page }) => {
    await page.goto('/real-estate');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.locator('.listing-card').getByRole('button', { name: 'Analyze' }).click();

    await expect(page.locator('#purchasePrice')).toHaveValue('385000');
    await expect(page.locator('#monthlyRent')).toHaveValue('1900');
    await expect(page.getByText('Profitability Analysis')).toBeVisible();
    await expect(page.locator('.verdict-banner')).toBeVisible();
  });

  test('Calculate Profitability is disabled until required fields are filled', async ({ authenticatedPage: page }) => {
    await page.goto('/real-estate');
    await page.locator('.real-estate-hero').getByRole('button', { name: 'Analyze a Property' }).click();
    await expect(page.getByRole('button', { name: 'Calculate Profitability' })).toBeDisabled();
    await page.locator('#purchasePrice').fill('200000');
    await page.locator('#monthlyRent').fill('2200');
    await expect(page.getByRole('button', { name: 'Calculate Profitability' })).toBeEnabled();
  });

  test('manual analysis computes metrics and saves the property', async ({ authenticatedPage: page }) => {
    let saved = false;
    await page.route('**/api/real-estate/properties', (route) => {
      if (route.request().method() === 'POST') {
        saved = true;
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...MOCK_PROPERTY, id: 'new-id' } }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: saved ? [MOCK_PROPERTY] : [] }),
        });
      }
    });
    await page.goto('/real-estate');
    await page.locator('.real-estate-hero').getByRole('button', { name: 'Analyze a Property' }).click();
    await page.locator('#purchasePrice').fill('152000');
    await page.locator('#monthlyRent').fill('1980');
    await page.getByRole('button', { name: 'Calculate Profitability' }).click();

    await expect(page.getByText('Profitability Analysis')).toBeVisible();
    await expect(page.locator('.result-label', { hasText: 'Monthly Cash Flow' })).toBeVisible();
    await expect(page.locator('.result-label', { hasText: 'Cap Rate' })).toBeVisible();

    const saveResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/real-estate/properties') && resp.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Save Property' }).click();
    await saveResp;
    await expect(page.locator('.property-item').filter({ hasText: 'Cleveland Duplex' })).toBeVisible();
  });

  test('shows saved properties with verdict pill', async ({ authenticatedPage: page }) => {
    await page.route('**/api/real-estate/properties', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [MOCK_PROPERTY] }) })
    );
    await page.goto('/real-estate');
    await expect(page.locator('.property-item').filter({ hasText: 'Cleveland Duplex' })).toBeVisible();
    await expect(page.locator('.verdict-pill')).toHaveText('Profitable');
  });

  test('Delete property calls DELETE API after confirm dialog', async ({ authenticatedPage: page }) => {
    let deleted = false;
    await page.route('**/api/real-estate/properties', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: deleted ? [] : [MOCK_PROPERTY] }),
      })
    );
    await page.route('**/api/real-estate/properties/**', (route) => {
      deleted = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('/real-estate');

    const deleteResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/real-estate/properties/') && resp.request().method() === 'DELETE'
    );
    await page.locator('.property-item').filter({ hasText: 'Cleveland Duplex' }).getByRole('button', { name: 'Delete' }).click();
    await deleteResp;
    await expect(page.getByText('No saved properties yet.')).toBeVisible();
  });

  test('shows empty state when no properties saved', async ({ authenticatedPage: page }) => {
    await page.goto('/real-estate');
    await expect(page.getByText('No saved properties yet.')).toBeVisible();
  });

  test('shows RentCast usage badge when the API key is configured', async ({ authenticatedPage: page }) => {
    await page.route('**/api/real-estate/usage', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...MOCK_USAGE, configured: true, used: 12, remaining: 38 } }),
      })
    );
    await page.goto('/real-estate');
    await expect(page.locator('.usage-badge')).toContainText('12 of 50 calls used');
  });

  test('hides usage badge when no API key is configured', async ({ authenticatedPage: page }) => {
    await page.goto('/real-estate');
    await expect(page.getByRole('heading', { level: 1, name: 'Real Estate' })).toBeVisible();
    await expect(page.locator('.usage-badge')).toHaveCount(0);
  });

  test('non-US listing shows a Google Maps link', async ({ authenticatedPage: page }) => {
    await page.goto('/real-estate');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const card = page.locator('.listing-card').filter({ hasText: 'Rua dos Anjos 38' });
    const link = card.getByRole('link', { name: 'View on Maps' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /google\.com\/maps\/search/);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('US listing shows a Zillow link', async ({ authenticatedPage: page }) => {
    const usListing = {
      ...MOCK_LISTING,
      id: 'sample-cleveland-1',
      address: '3315 Archwood Ave',
      city: 'Cleveland',
      country: 'United States',
    };
    await page.route(/\/api\/real-estate\/search/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { listings: [usListing], source: 'sample' } }),
      })
    );
    await page.goto('/real-estate');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const link = page.locator('.listing-card').getByRole('link', { name: 'View on Zillow' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /zillow\.com\/homes\/.*Archwood/);
  });

  test('saved US property card links to Zillow', async ({ authenticatedPage: page }) => {
    await page.route('**/api/real-estate/properties', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [MOCK_PROPERTY] }) })
    );
    await page.goto('/real-estate');
    const link = page.locator('.property-item').filter({ hasText: 'Cleveland Duplex' }).getByRole('link', { name: 'View on Zillow' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /zillow\.com\/homes\//);
  });

  test('shows quota warning when the monthly cap is reached', async ({ authenticatedPage: page }) => {
    await page.route('**/api/real-estate/usage', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...MOCK_USAGE, configured: true, used: 50, remaining: 0 } }),
      })
    );
    await page.route(/\/api\/real-estate\/search/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            listings: [MOCK_LISTING],
            source: 'sample',
            quotaExhausted: true,
            usage: { ...MOCK_USAGE, configured: true, used: 50, remaining: 0 },
          },
        }),
      })
    );
    await page.goto('/real-estate');
    await expect(page.locator('.quota-warning')).toContainText('Monthly RentCast limit reached');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.quota-warning')).toBeVisible();
    await expect(page.locator('.sample-badge')).toBeVisible();
  });

  test('shows a Cached badge and Refresh button for cached live results', async ({ authenticatedPage: page }) => {
    await page.route('**/api/real-estate/usage', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...MOCK_USAGE, configured: true, used: 3, remaining: 47 } }),
      })
    );
    await page.route(/\/api\/real-estate\/search/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            listings: [{ ...MOCK_LISTING, city: 'Austin', country: 'United States' }],
            source: 'rentcast',
            cached: true,
            cachedAt: '2026-06-09T12:00:00Z',
            usage: { ...MOCK_USAGE, configured: true, used: 3, remaining: 47 },
          },
        }),
      })
    );
    await page.goto('/real-estate');
    await page.locator('#location').fill('Austin, TX');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.cached-badge')).toContainText('Cached');
    await expect(page.getByRole('button', { name: /Refresh/ })).toBeVisible();
    await expect(page.locator('.sample-badge')).toHaveCount(0);
  });

  test('Refresh sends refresh=true to force a live call', async ({ authenticatedPage: page }) => {
    const refreshUrls: string[] = [];
    await page.route('**/api/real-estate/usage', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...MOCK_USAGE, configured: true, used: 3, remaining: 47 } }),
      })
    );
    await page.route(/\/api\/real-estate\/search/, (route) => {
      const url = route.request().url();
      refreshUrls.push(url);
      const cached = !url.includes('refresh=true');
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            listings: [{ ...MOCK_LISTING, city: 'Austin', country: 'United States' }],
            source: 'rentcast',
            cached,
            cachedAt: '2026-06-09T12:00:00Z',
            usage: { ...MOCK_USAGE, configured: true, used: 3, remaining: 47 },
          },
        }),
      });
    });
    await page.goto('/real-estate');
    await page.locator('#location').fill('Austin, TX');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.cached-badge')).toBeVisible();

    const refreshResp = page.waitForResponse((resp) => resp.url().includes('refresh=true'));
    await page.getByRole('button', { name: /Refresh/ }).click();
    await refreshResp;
    expect(refreshUrls.some((url) => url.includes('refresh=true'))).toBe(true);
    await expect(page.locator('.cached-badge')).toHaveCount(0);
  });
});
