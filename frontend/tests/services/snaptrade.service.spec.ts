import { firstValueFrom, of } from 'rxjs';

import { SnapTradeService } from '../../app/services/snaptrade.service';

describe('SnapTradeService', () => {
  it('loads dividend income with refresh params', async () => {
    const response = {
      success: true,
      data: {
        userId: 'user-1',
        lookbackDays: 365,
        totals: [{ currency: 'USD', annualIncome: 120, monthlyIncome: 10 }],
        accounts: [],
        symbols: [],
        paymentCount: 4,
        lastPaymentDate: '2026-04-01',
        source: 'average_historical_payout_current_holdings'
      }
    };
    const http = {
      get: jest.fn().mockReturnValue(of(response))
    };
    const service = new SnapTradeService(http as any);

    const income = await firstValueFrom(service.getDividendIncome(true));

    expect(income.totals[0].annualIncome).toBe(120);
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/snaptrade/dividend-income'), {
      params: { refresh: 'true' }
    });
  });

  it('updates dividend income frequency preferences', async () => {
    const http = {
      patch: jest.fn().mockReturnValue(of({
        success: true,
        data: { symbol: 'SCHD', currency: 'USD', paymentFrequency: 'monthly', paymentsPerYear: 12 }
      }))
    };
    const service = new SnapTradeService(http as any);

    const preference = await firstValueFrom(
      service.updateDividendIncomePreference({ symbol: 'SCHD', currency: 'USD', paymentFrequency: 'monthly' })
    );

    expect(preference.paymentsPerYear).toBe(12);
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/snaptrade/dividend-income/preferences'), {
      symbol: 'SCHD',
      currency: 'USD',
      paymentFrequency: 'monthly'
    });
  });
});
