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

  it('hides dividend income preferences', async () => {
    const http = {
      delete: jest.fn().mockReturnValue(of({
        success: true,
        data: { symbol: 'SCHD', currency: 'USD', paymentFrequency: 'monthly', paymentsPerYear: 12, hidden: true }
      }))
    };
    const service = new SnapTradeService(http as any);

    const preference = await firstValueFrom(
      service.hideDividendIncomePreference({ symbol: 'SCHD', currency: 'USD', paymentFrequency: 'monthly' })
    );

    expect(preference.hidden).toBe(true);
    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/snaptrade/dividend-income/preferences'), {
      body: { symbol: 'SCHD', currency: 'USD', paymentFrequency: 'monthly' }
    });
  });

  it('clears dividend income preferences', async () => {
    const http = {
      delete: jest.fn().mockReturnValue(of({
        success: true,
        data: { removed: 2 }
      }))
    };
    const service = new SnapTradeService(http as any);

    const result = await firstValueFrom(
      service.clearDividendIncomePreferences([{ symbol: 'SCHD', currency: 'USD' }])
    );

    expect(result.removed).toBe(2);
    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/snaptrade/dividend-income/preferences/symbols'), {
      body: { symbols: [{ symbol: 'SCHD', currency: 'USD' }] }
    });
  });

  it('updates recurring investment preferences', async () => {
    const http = {
      patch: jest.fn().mockReturnValue(of({
        success: true,
        data: { accountId: 'acc-1', symbol: 'BNDI', currency: 'USD', amount: 22, frequency: 'daily', hidden: false }
      }))
    };
    const service = new SnapTradeService(http as any);

    const preference = await firstValueFrom(
      service.updateRecurringInvestmentPreference({
        accountId: 'acc-1',
        symbol: 'BNDI',
        currency: 'USD',
        amount: 22,
        frequency: 'daily'
      })
    );

    expect(preference.amount).toBe(22);
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/snaptrade/recurring-investments/preferences'), {
      accountId: 'acc-1',
      symbol: 'BNDI',
      currency: 'USD',
      amount: 22,
      frequency: 'daily'
    });
  });

  it('hides recurring investment preferences', async () => {
    const http = {
      delete: jest.fn().mockReturnValue(of({
        success: true,
        data: { accountId: 'acc-1', symbol: 'BNDI', currency: 'USD', amount: null, frequency: null, hidden: true }
      }))
    };
    const service = new SnapTradeService(http as any);

    const preference = await firstValueFrom(
      service.hideRecurringInvestmentPreference({ accountId: 'acc-1', symbol: 'BNDI', currency: 'USD' })
    );

    expect(preference.hidden).toBe(true);
    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/snaptrade/recurring-investments/preferences'), {
      body: { accountId: 'acc-1', symbol: 'BNDI', currency: 'USD' }
    });
  });

  it('clears recurring investment preferences for an account', async () => {
    const http = {
      delete: jest.fn().mockReturnValue(of({
        success: true,
        data: { accountId: 'acc-1', removed: 2 }
      }))
    };
    const service = new SnapTradeService(http as any);

    const result = await firstValueFrom(service.clearRecurringInvestmentPreferences('acc-1'));

    expect(result.removed).toBe(2);
    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/snaptrade/recurring-investments/preferences/accounts/acc-1'));
  });

  it('loads saved portfolio balance snapshots', async () => {
    const http = {
      get: jest.fn().mockReturnValue(of({
        success: true,
        data: [
          {
            snapshotDate: '2026-05-10',
            totalBalance: 1000,
            totalGainLoss: 25,
            totalGainLossPercent: 2.56,
            accountCount: 2,
            currency: 'USD'
          }
        ]
      }))
    };
    const service = new SnapTradeService(http as any);

    const snapshots = await firstValueFrom(service.getPortfolioSnapshots());

    expect(snapshots[0].totalBalance).toBe(1000);
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/snaptrade/portfolio/snapshots'));
  });
});
