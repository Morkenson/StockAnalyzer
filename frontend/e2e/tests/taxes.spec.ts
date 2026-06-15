import { test, expect } from '../fixtures/auth.fixture';

const MOCK_PROFILE = {
  id: 'tax-profile-1',
  taxYear: 2025,
  filingStatus: 'single',
  grossIncome: 120000,
  preTaxContributions: 12000,
  useItemized: false,
  itemizedDeduction: 0,
  withholdingsPaid: 25000,
  createdAt: '2026-06-14T00:00:00Z',
  updatedAt: '2026-06-14T00:00:00Z',
};

function calculation(overrides: Record<string, unknown> = {}) {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    grossIncome: 120000,
    preTaxContributions: 12000,
    agi: 108000,
    deduction: 15000,
    taxableIncome: 93000,
    federalTax: 15374,
    ficaTax: 9180,
    socialSecurityTax: 7440,
    medicareTax: 1740,
    additionalMedicareTax: 0,
    stateTax: 4532.55,
    totalTax: 29086.55,
    withholdingsPaid: 25000,
    balanceDue: 4086.55,
    effectiveRate: 24.24,
    ...overrides,
  };
}

async function mockCommonApis(page: any) {
  await page.route('**/api/watchlists', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
  await page.route('**/api/watchlists/*/items', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
}

async function mockTaxesApis(page: any, options: { profile?: typeof MOCK_PROFILE | null; incomeByMonth?: Record<string, number> } = {}) {
  const incomeByMonth = options.incomeByMonth || {};
  await page.route('**/api/taxes/profile', (route: any) => {
    if (route.request().method() === 'PUT') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...MOCK_PROFILE, ...route.request().postDataJSON() } }),
      });
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: options.profile ?? null }),
    });
  });
  await page.route(/\/api\/cashflow\/entries/, (route: any) => {
    const url = new URL(route.request().url());
    const month = url.searchParams.get('month') || '';
    const amount = incomeByMonth[month] || 0;
    const data = amount
      ? [
          { id: `income-${month}`, type: 'income', name: 'Salary', category: 'Employment', amount, date: `${month}-15`, source: 'manual' },
          { id: `expense-${month}`, type: 'expense', name: 'Rent', category: 'Housing', amount: 1000, date: `${month}-01`, source: 'manual' },
        ]
      : [];
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  await page.route('**/api/taxes/calculate', (route: any) => {
    const body = route.request().postDataJSON();
    const grossIncome = Number(body.grossIncome || 0);
    const withholdingsPaid = Number(body.withholdingsPaid || 0);
    const totalTax = grossIncome === 60000 ? 13950 : 29086.55;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: calculation({
          grossIncome,
          withholdingsPaid,
          agi: Math.max(0, grossIncome - Number(body.preTaxContributions || 0)),
          totalTax,
          balanceDue: Math.round((totalTax - withholdingsPaid) * 100) / 100,
          effectiveRate: grossIncome ? Math.round((totalTax / grossIncome) * 10000) / 100 : 0,
        }),
      }),
    });
  });
}

test.describe('Taxes', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await mockCommonApis(authenticatedPage);
    await mockTaxesApis(authenticatedPage);
  });

  test('renders the Taxes tab and page shell', async ({ authenticatedPage: page }) => {
    await page.goto('/taxes');
    await expect(page.locator('.page-kicker')).toHaveText('Planning');
    await expect(page.getByRole('heading', { level: 1, name: 'Taxes' })).toBeVisible();
    await expect(page.getByText('Wisconsin estimate, not tax advice.')).toBeVisible();
  });

  test('header nav contains a Taxes tab that routes to the page', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await page.locator('nav.nav').getByRole('link', { name: 'Taxes' }).click();
    await expect(page).toHaveURL(/\/taxes$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Taxes' })).toBeVisible();
  });

  test('prefills gross income from income entries and calculates a balance due', async ({ authenticatedPage: page }) => {
    await page.route('**/api/taxes/profile', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) })
    );
    await page.route(/\/api\/cashflow\/entries/, (route) => {
      const month = new URL(route.request().url()).searchParams.get('month');
      const amount = month === '2025-01' ? 5000 : month === '2025-02' ? 5500 : 0;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: amount ? [{ id: `income-${month}`, type: 'income', name: 'Paycheck', category: 'Employment', amount, date: `${month}-15`, source: 'manual' }] : [],
        }),
      });
    });
    await page.goto('/taxes');

    await expect(page.locator('#grossIncome')).toHaveValue('10500');
    await expect(page.getByText('Pulled from your income section for this tax year.')).toBeVisible();
    await expect(page.getByText('Estimated Balance Due')).toBeVisible();
  });

  test('loads a saved profile without overwriting its gross income', async ({ authenticatedPage: page }) => {
    await page.route('**/api/taxes/profile', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_PROFILE }) })
    );
    await page.goto('/taxes');

    await expect(page.locator('#grossIncome')).toHaveValue('120000');
    await expect(page.locator('#preTaxContributions')).toHaveValue('12000');
    await expect(page.locator('#withholdingsPaid')).toHaveValue('25000');
    await expect(page.getByText('Effective rate')).toBeVisible();
  });

  test('edits inputs, shows refund state, and saves the profile', async ({ authenticatedPage: page }) => {
    let savedPayload: any = null;
    await page.route('**/api/taxes/profile', (route) => {
      if (route.request().method() === 'PUT') {
        savedPayload = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...MOCK_PROFILE, ...savedPayload } }),
        });
        return;
      }
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
    });
    await page.goto('/taxes');

    await page.locator('#grossIncome').fill('60000');
    await page.locator('#withholdingsPaid').fill('20000');
    await expect(page.getByText('Estimated Refund')).toBeVisible();

    const saveResp = page.waitForResponse((resp) => resp.url().includes('/api/taxes/profile') && resp.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save' }).click();
    await saveResp;

    expect(savedPayload.grossIncome).toBe(60000);
    expect(savedPayload.withholdingsPaid).toBe(20000);
    await expect(page.getByText('Saved.')).toBeVisible();
  });

  test('itemized deduction toggle reveals the itemized input and sends it to calculate', async ({ authenticatedPage: page }) => {
    let calculatedPayload: any = null;
    await page.route('**/api/taxes/calculate', (route) => {
      calculatedPayload = route.request().postDataJSON();
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: calculation() }) });
    });
    await page.goto('/taxes');

    await page.getByRole('button', { name: 'Itemized' }).click();
    await page.locator('#itemizedDeduction').fill('32000');
    await expect.poll(() => calculatedPayload?.useItemized).toBe(true);
    expect(calculatedPayload.itemizedDeduction).toBe(32000);
  });
});
