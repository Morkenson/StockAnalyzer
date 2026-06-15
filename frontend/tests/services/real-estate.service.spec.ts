import { Subject, firstValueFrom, of, throwError } from 'rxjs';

import { RealEstateService } from '../../app/services/real-estate.service';
import { RealEstatePropertyRow } from '../../app/models/real-estate.model';

describe('RealEstateService', () => {
  const user = { id: 'user-1', email: 'zach@example.com' };
  const row: RealEstatePropertyRow = {
    id: 'prop-1',
    name: 'Duplex on Main',
    currency: 'USD',
    purchasePrice: 300000,
    downPaymentPct: 20,
    closingCosts: 5000,
    interestRate: 6,
    loanTermYears: 30,
    monthlyRent: 2500,
    vacancyRatePct: 5,
    propertyTaxAnnual: 3000,
    insuranceAnnual: 1200,
    hoaMonthly: 0,
    maintenancePct: 5,
    managementPct: 8,
    otherMonthlyCosts: 0,
    appreciationPct: 3,
    holdYears: 10,
    monthlyCashFlow: 350,
    capRate: 5.5,
    cashOnCashReturn: 7.2,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z'
  };

  let currentUser$: Subject<any>;

  const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  function createService(http: any, loggedInUser: any = user) {
    currentUser$ = new Subject<any>();
    const authService = {
      currentUser$,
      getCurrentUser: jest.fn().mockReturnValue(loggedInUser)
    };
    return new RealEstateService(http as any, authService as any);
  }

  it('loads and maps properties when a user logs in', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [row] })) };
    const service = createService(http);

    currentUser$.next(user);
    await flush();

    const properties = service.getCurrentProperties();
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/real-estate/properties'));
    expect(properties).toHaveLength(1);
    expect(properties[0].id).toBe('prop-1');
    expect(properties[0].monthlyCashFlow).toBe(350);
    expect(properties[0].createdAt).toEqual(new Date(row.createdAt));
    expect(properties[0].updatedAt).toEqual(new Date(row.updatedAt));
  });

  it('clears properties on logout', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [row] })) };
    const service = createService(http);
    currentUser$.next(user);
    await flush();

    currentUser$.next(null);

    expect(service.getCurrentProperties()).toEqual([]);
  });

  it('falls back to an empty list when loading fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const http = { get: jest.fn().mockReturnValue(throwError(() => new Error('boom'))) };
    const service = createService(http);

    currentUser$.next(user);
    await flush();

    expect(service.getCurrentProperties()).toEqual([]);
    errorSpy.mockRestore();
  });

  it('searches listings with only the provided params', async () => {
    const result = { listings: [], source: 'rentcast' };
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: result })) };
    const service = createService(http);

    const found = await service.searchListings({
      location: 'Austin, TX',
      minPrice: 100000,
      maxPrice: 500000,
      propertyType: 'single_family',
      minBedrooms: 2
    });

    expect(found).toEqual(result);
    const [url, options] = http.get.mock.calls[0];
    expect(url).toContain('/real-estate/search');
    const query = options.params.toString();
    expect(query).toContain('location=Austin');
    expect(query).toContain('minPrice=100000');
    expect(query).toContain('maxPrice=500000');
    expect(query).toContain('propertyType=single_family');
    expect(query).toContain('minBedrooms=2');
  });

  it('omits unset search params and falls back to a sample result', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true })) };
    const service = createService(http);

    const found = await service.searchListings({});

    expect(found).toEqual({ listings: [], source: 'sample' });
    expect(http.get.mock.calls[0][1].params.toString()).toBe('');
  });

  it('returns Rentcast usage data or null', async () => {
    const usage = {
      provider: 'rentcast',
      configured: true,
      used: 10,
      limit: 50,
      remaining: 40,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30'
    };
    const httpWithUsage = { get: jest.fn().mockReturnValue(of({ success: true, data: usage })) };
    await expect(createService(httpWithUsage).getUsage()).resolves.toEqual(usage);
    expect(httpWithUsage.get).toHaveBeenCalledWith(expect.stringContaining('/real-estate/usage'));

    const httpWithoutUsage = { get: jest.fn().mockReturnValue(of({ success: true })) };
    await expect(createService(httpWithoutUsage).getUsage()).resolves.toBeNull();
  });

  it('creates a property, reloads the list and returns the mapped record', async () => {
    const http = {
      post: jest.fn().mockReturnValue(of({ success: true, data: row })),
      get: jest.fn().mockReturnValue(of({ success: true, data: [row] }))
    };
    const service = createService(http);
    const payload = {
      name: row.name,
      currency: row.currency,
      purchasePrice: row.purchasePrice,
      downPaymentPct: row.downPaymentPct,
      closingCosts: row.closingCosts,
      interestRate: row.interestRate,
      loanTermYears: row.loanTermYears,
      monthlyRent: row.monthlyRent,
      vacancyRatePct: row.vacancyRatePct,
      propertyTaxAnnual: row.propertyTaxAnnual,
      insuranceAnnual: row.insuranceAnnual,
      hoaMonthly: row.hoaMonthly,
      maintenancePct: row.maintenancePct,
      managementPct: row.managementPct,
      otherMonthlyCosts: row.otherMonthlyCosts,
      appreciationPct: row.appreciationPct,
      holdYears: row.holdYears,
      monthlyCashFlow: row.monthlyCashFlow,
      capRate: row.capRate,
      cashOnCashReturn: row.cashOnCashReturn
    };

    const created = await service.createProperty(payload);

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/real-estate/properties'), payload);
    expect(created.id).toBe('prop-1');
    expect(created.createdAt).toEqual(new Date(row.createdAt));
    expect(service.getCurrentProperties()).toHaveLength(1);
  });

  it('updates a property and reloads the list', async () => {
    const http = {
      patch: jest.fn().mockReturnValue(of({ success: true, data: row })),
      get: jest.fn().mockReturnValue(of({ success: true, data: [row] }))
    };
    const service = createService(http);

    await service.updateProperty('prop-1', { monthlyRent: 2600 });

    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/real-estate/properties/prop-1'), {
      monthlyRent: 2600
    });
    expect(http.get).toHaveBeenCalled();
  });

  it('deletes a property and reloads the list', async () => {
    const http = {
      delete: jest.fn().mockReturnValue(of({ success: true })),
      get: jest.fn().mockReturnValue(of({ success: true, data: [] }))
    };
    const service = createService(http);

    await service.deleteProperty('prop-1');

    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/real-estate/properties/prop-1'));
    expect(service.getCurrentProperties()).toEqual([]);
  });

  it('refreshProperties reloads from the API', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [row] })) };
    const service = createService(http);

    await service.refreshProperties();

    expect(service.getCurrentProperties()).toHaveLength(1);
  });

  it('does not call the API when refreshing while logged out', async () => {
    const http = { get: jest.fn() };
    const service = createService(http, null);

    await service.refreshProperties();

    expect(http.get).not.toHaveBeenCalled();
    expect(service.getCurrentProperties()).toEqual([]);
  });
});
