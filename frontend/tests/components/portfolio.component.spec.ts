import { of, throwError } from 'rxjs';

import { PortfolioComponent } from '../../app/components/portfolio.component';
import { DividendIncomeSummary, Portfolio } from '../../app/models/snaptrade.model';
import { SnapTradeService } from '../../app/services/snaptrade.service';

describe('PortfolioComponent dividend income', () => {
  const portfolio: Portfolio = {
    userId: 'user-1',
    accounts: [
      {
        id: 'acc-1',
        accountNumber: '001',
        name: 'Brokerage',
        type: 'MARGIN',
        brokerageId: 'broker-1',
        balance: 1000,
        currency: 'USD',
        holdings: []
      }
    ],
    totalBalance: 1000,
    totalGainLoss: 0,
    totalGainLossPercent: 0,
    currency: 'USD'
  };

  const dividendIncome: DividendIncomeSummary = {
    userId: 'user-1',
    lookbackDays: 365,
    totals: [{ currency: 'USD', annualIncome: 120, monthlyIncome: 10 }],
    accounts: [],
    symbols: [
      {
        symbol: 'SCHD',
        currency: 'USD',
        currentQuantity: 10,
        annualIncome: 120,
        monthlyIncome: 10,
        averagePaymentPerShare: 3,
        paymentFrequency: 'quarterly',
        paymentsPerYear: 4,
        paymentCount: 4,
        lastPaymentDate: '2026-04-01'
      }
    ],
    paymentCount: 4,
    lastPaymentDate: '2026-04-01',
    source: 'average_historical_payout_current_holdings'
  };

  function createComponent(dividend$ = of(dividendIncome)) {
    const snapTradeService = {
      getPortfolio: jest.fn().mockReturnValue(of(portfolio)),
      getRecurringInvestments: jest.fn().mockReturnValue(of([])),
      getDividendIncome: jest.fn().mockReturnValue(dividend$),
      updateDividendIncomePreference: jest.fn().mockReturnValue(of({
        symbol: 'SCHD',
        currency: 'USD',
        paymentFrequency: 'monthly',
        paymentsPerYear: 12
      })),
      updateAccountPreference: jest.fn(),
      hideAccount: jest.fn(),
      initiateConnection: jest.fn()
    };
    const router = { navigate: jest.fn() };
    const component = new PortfolioComponent(
      snapTradeService as unknown as SnapTradeService,
      router as any
    );

    component.ngOnInit();

    return { component, snapTradeService };
  }

  it('loads annual and monthly dividend income after portfolio load', () => {
    const { component, snapTradeService } = createComponent();

    expect(component.getPrimaryDividendTotal()?.annualIncome).toBe(120);
    expect(component.getPrimaryDividendTotal()?.monthlyIncome).toBe(10);
    expect(component.getDividendHoldingCount()).toBe(1);
    expect(component.hasDividendIncome()).toBe(true);
    expect(snapTradeService.getDividendIncome).toHaveBeenCalledWith(false);
  });

  it('keeps portfolio visible when dividend income fails', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { component } = createComponent(throwError(() => ({ error: { message: 'Dividend data unavailable' } })));

    expect(component.portfolio?.totalBalance).toBe(1000);
    expect(component.dividendIncome).toBeNull();
    expect(component.dividendError).toBe('Dividend data unavailable');

    consoleError.mockRestore();
  });

  it('refreshes dividend income with refresh=true', () => {
    const { component, snapTradeService } = createComponent();

    component.refreshPortfolio();

    expect(snapTradeService.getDividendIncome).toHaveBeenLastCalledWith(true);
  });

  it('saves manual dividend frequency and reloads the estimate', () => {
    const { component, snapTradeService } = createComponent();

    component.updateDividendFrequency('SCHD', 'USD', 'monthly');

    expect(snapTradeService.updateDividendIncomePreference).toHaveBeenCalledWith({
      symbol: 'SCHD',
      currency: 'USD',
      paymentFrequency: 'monthly'
    });
    expect(snapTradeService.getDividendIncome).toHaveBeenLastCalledWith(true);
    expect(component.savingDividendPreferenceKey).toBeNull();
  });
});
