import { of } from 'rxjs';

import { TaxesService } from '../../app/services/taxes.service';
import { TaxProfile, TaxProfileInputs } from '../../app/models/taxes.model';

describe('TaxesService', () => {
  const profile: TaxProfile = {
    id: 'tax-1',
    taxYear: 2025,
    filingStatus: 'single',
    grossIncome: 120000,
    preTaxContributions: 12000,
    useItemized: false,
    itemizedDeduction: 0,
    withholdingsPaid: 25000,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z'
  };
  const inputs: TaxProfileInputs = {
    taxYear: 2025,
    filingStatus: 'single',
    grossIncome: 120000,
    preTaxContributions: 12000,
    useItemized: false,
    itemizedDeduction: 0,
    withholdingsPaid: 25000
  };

  it('gets a saved profile or null', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: profile })) };
    const service = new TaxesService(http as any);

    await expect(service.getProfile()).resolves.toEqual(profile);
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/taxes/profile'));

    const emptyHttp = { get: jest.fn().mockReturnValue(of({ success: true })) };
    await expect(new TaxesService(emptyHttp as any).getProfile()).resolves.toBeNull();
  });

  it('saves a profile with PUT', async () => {
    const http = { put: jest.fn().mockReturnValue(of({ success: true, data: profile })) };
    const service = new TaxesService(http as any);

    await expect(service.saveProfile(inputs)).resolves.toEqual(profile);
    expect(http.put).toHaveBeenCalledWith(expect.stringContaining('/taxes/profile'), inputs);
  });

  it('calculates taxes with POST', async () => {
    const result = {
      taxYear: 2025,
      filingStatus: 'single',
      grossIncome: 120000,
      preTaxContributions: 12000,
      agi: 108000,
      deduction: 15000,
      taxableIncome: 93000,
      federalTax: 15368,
      ficaTax: 9180,
      socialSecurityTax: 7440,
      medicareTax: 1740,
      additionalMedicareTax: 0,
      stateTax: 4463.4,
      totalTax: 29011.4,
      withholdingsPaid: 25000,
      balanceDue: 4011.4,
      effectiveRate: 24.18
    };
    const http = { post: jest.fn().mockReturnValue(of({ success: true, data: result })) };
    const service = new TaxesService(http as any);

    await expect(service.calculate(inputs)).resolves.toEqual(result);
    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/taxes/calculate'), inputs);
  });
});
