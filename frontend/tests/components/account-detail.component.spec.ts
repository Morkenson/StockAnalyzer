import { of } from 'rxjs';

import { AccountDetailComponent } from '../../app/components/account-detail.component';
import { DividendIncomeSummary, Portfolio, RecurringInvestment } from '../../app/models/snaptrade.model';
import { SnapTradeService } from '../../app/services/snaptrade.service';

describe('AccountDetailComponent', () => {
  const portfolio: Portfolio = {
    userId: 'user-1',
    accounts: [
      {
        id: 'acc-1',
        accountNumber: '001',
        name: 'Brokerage',
        nickname: 'Main Investing',
        type: 'MARGIN',
        brokerageId: 'broker-1',
        balance: 2000,
        currency: 'USD',
        holdings: [
          {
            id: 'holding-1',
            symbol: 'AAPL',
            quantity: 4,
            averagePurchasePrice: 100,
            currentPrice: 150,
            totalValue: 600,
            bookValue: 400,
            gainLoss: 200,
            gainLossPercent: 50,
            currency: 'USD'
          },
          {
            id: 'holding-2',
            symbol: 'MSFT',
            quantity: 2,
            averagePurchasePrice: 200,
            currentPrice: 250,
            totalValue: 500,
            bookValue: 400,
            gainLoss: 100,
            gainLossPercent: 25,
            currency: 'USD'
          }
        ]
      },
      {
        id: 'acc-2',
        accountNumber: '002',
        name: 'Roth',
        type: 'CASH',
        brokerageId: 'broker-2',
        balance: 1000,
        currency: 'USD',
        holdings: []
      }
    ],
    totalBalance: 3000,
    totalGainLoss: 300,
    totalGainLossPercent: 11.11,
    currency: 'USD'
  };

  const recurringInvestments: RecurringInvestment[] = [
    {
      symbol: 'AAPL',
      accountId: 'acc-1',
      accountName: 'Main Investing',
      amount: 50,
      currency: 'USD',
      frequency: 'monthly',
      confidence: 0.8,
      occurrences: 4,
      lastDate: '2026-04-01',
      nextEstimatedDate: '2026-05-01',
      source: 'inferred'
    },
    {
      symbol: 'VTI',
      accountId: 'acc-2',
      accountName: 'Roth',
      amount: 25,
      currency: 'USD',
      frequency: 'weekly',
      confidence: 0.7,
      occurrences: 3,
      lastDate: '2026-04-05',
      source: 'inferred'
    }
  ];

  const dividendIncome: DividendIncomeSummary = {
    userId: 'user-1',
    lookbackDays: 365,
    totals: [{ currency: 'USD', annualIncome: 120, monthlyIncome: 10 }],
    accounts: [
      {
        accountId: 'acc-1',
        accountName: 'Main Investing',
        currency: 'USD',
        annualIncome: 96,
        monthlyIncome: 8,
        paymentCount: 4,
        lastPaymentDate: '2026-04-01'
      },
      {
        accountId: 'acc-2',
        accountName: 'Roth',
        currency: 'USD',
        annualIncome: 24,
        monthlyIncome: 2,
        paymentCount: 1,
        lastPaymentDate: '2026-03-15'
      }
    ],
    symbols: [
      {
        symbol: 'AAPL',
        accountId: 'acc-1',
        accountName: 'Main Investing',
        currency: 'USD',
        currentQuantity: 4,
        annualIncome: 72,
        monthlyIncome: 6,
        averagePaymentPerShare: 1.5,
        paymentFrequency: 'quarterly',
        paymentsPerYear: 4,
        paymentCount: 4,
        lastPaymentDate: '2026-04-01'
      },
      {
        symbol: 'VTI',
        accountId: 'acc-2',
        accountName: 'Roth',
        currency: 'USD',
        currentQuantity: 2,
        annualIncome: 24,
        monthlyIncome: 2,
        averagePaymentPerShare: 3,
        paymentFrequency: 'quarterly',
        paymentsPerYear: 4,
        paymentCount: 1,
        lastPaymentDate: '2026-03-15'
      }
    ],
    paymentCount: 5,
    lastPaymentDate: '2026-04-01',
    source: 'average_historical_payout_current_holdings'
  };

  function createComponent(accountId = 'acc-1', accountSnapshots?: any[]) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const defaultHistory = [
      { snapshotDate: yesterday.toISOString().slice(0, 10), accountId: 'acc-1', totalBalance: 800, currency: 'USD' },
      { snapshotDate: today.toISOString().slice(0, 10), accountId: 'acc-1', totalBalance: 860, currency: 'USD' }
    ];
    const snapTradeService = {
      getPortfolio: jest.fn().mockReturnValue(of(portfolio)),
      getAccountSnapshots: jest.fn().mockReturnValue(of(accountSnapshots || defaultHistory)),
      getRecurringInvestments: jest.fn().mockReturnValue(of(recurringInvestments)),
      updateRecurringInvestmentPreference: jest.fn((preference: any) => of({
        accountId: preference.accountId,
        symbol: preference.symbol,
        currency: preference.currency || 'USD',
        amount: preference.amount,
        frequency: preference.frequency,
        hidden: !!preference.hidden
      })),
      hideRecurringInvestmentPreference: jest.fn((preference: any) => of({
        accountId: preference.accountId,
        symbol: preference.symbol,
        currency: preference.currency || 'USD',
        amount: null,
        frequency: null,
        hidden: true
      })),
      clearRecurringInvestmentPreferences: jest.fn().mockReturnValue(of({ accountId: 'acc-1', removed: 1 })),
      getDividendIncome: jest.fn().mockReturnValue(of(dividendIncome)),
      updateDividendIncomePreference: jest.fn((preference: any) => of({
        symbol: preference.symbol,
        currency: preference.currency || 'USD',
        paymentFrequency: preference.paymentFrequency,
        paymentsPerYear: 12,
        hidden: !!preference.hidden
      })),
      hideDividendIncomePreference: jest.fn((preference: any) => of({
        symbol: preference.symbol,
        currency: preference.currency || 'USD',
        paymentFrequency: preference.paymentFrequency || 'annual',
        paymentsPerYear: 1,
        hidden: true
      })),
      clearDividendIncomePreferences: jest.fn().mockReturnValue(of({ removed: 1 })),
      updateAccountPreference: jest.fn((accountId: string, preference: any) => of({
        accountId,
        nickname: preference.nickname ?? 'New Name',
        marginBalance: preference.marginBalance,
        marginInterestRate: preference.marginInterestRate,
        hidden: !!preference.hidden
      })),
      hideAccount: jest.fn().mockReturnValue(of({ accountId: 'acc-1', hidden: true }))
    };
    const route = {
      snapshot: {
        paramMap: {
          get: jest.fn().mockReturnValue(accountId)
        }
      }
    };
    const router = { navigate: jest.fn() };
    const component = new AccountDetailComponent(
      snapTradeService as unknown as SnapTradeService,
      route as any,
      router as any
    );

    component.ngOnInit();

    return { component, snapTradeService, router };
  }

  it('loads the matching account from the portfolio', () => {
    const { component, snapTradeService } = createComponent();

    expect(component.account?.id).toBe('acc-1');
    expect(component.notFound).toBe(false);
    expect(snapTradeService.getPortfolio).toHaveBeenCalledWith(false);
  });

  it('computes account totals and allocation', () => {
    const { component } = createComponent();

    expect(component.getAccountTotalValue(component.account!)).toBe(1100);
    expect(component.getMarginBalance(component.account!)).toBe(0);
    expect(component.getAccountTotalGainLoss(component.account!)).toBe(300);
    expect(component.getAccountTotalGainLossPercent(component.account!)).toBe(37.5);
    expect(component.getPortfolioAllocation(component.account!, component.portfolio!)).toBeCloseTo(66.67, 2);
    expect(component.getHoldingAllocation(component.account!.holdings![0], component.account!)).toBeCloseTo(54.55, 2);
    expect(component.getAccountHoldingsAllocationTotal(component.account!)).toBe(100);
    expect(component.getLargestHolding(component.account!)?.symbol).toBe('AAPL');
  });

  it('filters recurring buys and dividend income by account id', () => {
    const { component, snapTradeService } = createComponent();

    expect(snapTradeService.getRecurringInvestments).toHaveBeenCalledWith(false);
    expect(component.filteredRecurringInvestments).toEqual([recurringInvestments[0]]);
    expect(component.getRecurringOrderTotal()).toBe(50);
    expect(component.getRecurringMonthlyTotal()).toBe(50);
    expect(component.getRecurringYearlyTotal()).toBe(600);
    expect(component.getRecurringDailyTotal()).toBeCloseTo(2.38, 2);
    expect(component.getRecurringCurrentAllocation(component.filteredRecurringInvestments[0])).toBeCloseTo(54.55, 2);
    expect(component.getRecurringFutureAllocation(component.filteredRecurringInvestments[0])).toBe(100);
    expect(component.getAccountDividendIncome()?.annualIncome).toBe(96);
    expect(component.getAccountDividendSymbols().map(item => item.symbol)).toEqual(['AAPL']);
  });

  it('projects future value and income for the individual account', () => {
    const { component } = createComponent();

    component.toggleFuture();

    expect(component.showFuture).toBe(true);
    expect(component.reinvestDividends).toBe(true);
    expect(component.getAccountAnnualDividendIncome()).toBe(96);
    expect(component.getAccountDividendYield()).toBeCloseTo(4.8, 2);
    expect(component.getFutureProjections()).toHaveLength(20);
    expect(component.getFutureProjections().find(projection => projection.label === 'Year 5')?.value).toBeCloseTo(5830.5, 2);
    expect(component.getFutureProjections().find(projection => projection.label === 'Year 5')?.monthlyIncome).toBeCloseTo(23.32, 2);
  });

  it('switches the account chart to estimated future value when future mode is active', () => {
    const { component } = createComponent();

    expect(component.getActiveChartEyebrow()).toBe('Balance History');
    expect(component.getActiveChartRangeLabel()).toBe('1M');
    expect(component.getActiveChartData().map(point => point.close)).toEqual([800, 860]);

    component.toggleFuture();

    const futureChartData = component.getActiveChartData();

    expect(component.getActiveChartEyebrow()).toBe('Estimated Future Value');
    expect(component.getActiveChartRangeLabel()).toBe('20Y');
    expect(futureChartData).toHaveLength(241);
    expect(futureChartData[0].close).toBe(2000);
    expect(futureChartData[60].close).toBeCloseTo(5830.5, 2);
    expect(component.getActiveChartChange()).toBeCloseTo(futureChartData[240].close - 2000, 2);
    expect(component.getActiveChartChangePercent()).toBeGreaterThan(0);
  });

  it('can reinvest future dividends into projected value', () => {
    const { component } = createComponent();

    component.reinvestDividends = false;

    expect(component.getFutureProjections().find(projection => projection.label === 'Year 5')?.value).toBe(5000);
    expect(component.getFutureProjections().find(projection => projection.label === 'Year 5')?.monthlyIncome).toBeCloseTo(20, 2);
  });

  it('uses the editable monthly contribution amount for future projections', () => {
    const { component } = createComponent();

    expect(component.getFutureMonthlyContribution()).toBe(50);

    component.setFutureMonthlyContribution(200);
    component.reinvestDividends = false;

    expect(component.getRecurringMonthlyTotal()).toBe(50);
    expect(component.getFutureMonthlyContribution()).toBe(200);
    expect(component.getFutureProjections().find(projection => projection.label === 'Year 5')?.value).toBe(14000);
    expect(component.getFutureProjections().find(projection => projection.label === 'Year 5')?.monthlyIncome).toBeCloseTo(56, 2);
  });

  it('uses gross holding value for margin-account future yield when balance is net of margin', () => {
    const { component } = createComponent();
    component.account = {
      ...component.account!,
      balance: 300,
      type: 'MARGIN'
    };

    expect(component.getFutureYieldLabel()).toBe('Income Yield (Gross)');
    expect(component.getAccountDividendYield()).toBeCloseTo(8.73, 2);
    expect(component.getFutureProjections().find(projection => projection.label === 'Year 1')?.value).toBeCloseTo(1796, 2);
  });

  it('estimates and saves manual margin balance', () => {
    const { component, snapTradeService } = createComponent();
    component.account = {
      ...component.account!,
      balance: 300,
      type: 'MARGIN'
    };

    expect(component.getMarginBalance(component.account!)).toBe(800);

    component.startMarginEdit(component.account!);
    component.marginDraft = 725;
    component.marginInterestRateDraft = 12.5;
    component.saveMargin(component.account!);

    expect(snapTradeService.updateAccountPreference).toHaveBeenCalledWith('acc-1', {
      marginBalance: 725,
      marginInterestRate: 12.5
    });
    expect(component.account?.marginBalance).toBe(725);
    expect(component.account?.marginInterestRate).toBe(12.5);
    expect(component.getMarginBalance(component.account!)).toBe(725);
    expect(component.getAnnualMarginCost(component.account!)).toBeCloseTo(90.63, 2);
    expect(component.getMonthlyMarginCost(component.account!)).toBeCloseTo(7.55, 2);
    expect(component.getAccountNetAnnualIncome()).toBeCloseTo(5.38, 2);
    expect(component.getAccountNetMonthlyIncome()).toBeCloseTo(0.45, 2);
    expect(component.editingMargin).toBe(false);
  });

  it('uses margin interest cost to net down future income figures', () => {
    const { component } = createComponent();
    component.account = {
      ...component.account!,
      balance: 300,
      marginInterestRate: 12.5,
      type: 'MARGIN'
    };

    expect(component.getAnnualMarginCost(component.account!)).toBe(100);
    expect(component.getAccountNetAnnualIncome()).toBe(-4);
    expect(component.getAccountDividendYield()).toBeCloseTo(-0.36, 2);
    expect(component.getFutureProjections().find(projection => projection.label === 'Year 1')?.annualIncome).toBeCloseTo(-6.17, 2);
  });

  it('edits and removes dividend rows in the account view', () => {
    const { component, snapTradeService } = createComponent();
    const symbol = component.getAccountDividendSymbols()[0];

    component.startDividendEdit(0, symbol);
    component.dividendEditDraft = { paymentFrequency: 'monthly' };
    component.saveDividendEdit(0, symbol);

    expect(snapTradeService.updateDividendIncomePreference).toHaveBeenCalledWith({
      symbol: 'AAPL',
      currency: 'USD',
      paymentFrequency: 'monthly',
      hidden: false
    });
    expect(snapTradeService.getDividendIncome).toHaveBeenLastCalledWith(true);

    component.removeDividendSymbol(0, symbol);

    expect(snapTradeService.hideDividendIncomePreference).toHaveBeenCalledWith({
      symbol: 'AAPL',
      currency: 'USD',
      paymentFrequency: 'monthly'
    });
    expect(snapTradeService.getDividendIncome).toHaveBeenLastCalledWith(true);
  });

  it('clears manual dividend changes and reloads dividend income', () => {
    const { component, snapTradeService } = createComponent();

    component.clearDividendManualChanges();

    expect(snapTradeService.clearDividendIncomePreferences).toHaveBeenCalledWith([]);
    expect(snapTradeService.getDividendIncome).toHaveBeenLastCalledWith(true);
    expect(component.clearingDividendChanges).toBe(false);
  });

  it('filters recurring buys for the second account too', () => {
    const { component } = createComponent('acc-2');

    expect(component.filteredRecurringInvestments).toEqual([recurringInvestments[1]]);
    expect(component.getRecurringMonthlyTotal()).toBeCloseTo(108.33, 2);
    expect(component.getRecurringYearlyTotal()).toBe(1300);
  });

  it('annualizes daily recurring buys by trading days', () => {
    const { component } = createComponent();
    component.filteredRecurringInvestments = [
      {
        symbol: 'BNDI',
        accountId: 'acc-1',
        accountName: 'Main Investing',
        amount: 22,
        currency: 'USD',
        frequency: 'daily',
        confidence: 0.9,
        occurrences: 5,
        lastDate: '2026-05-01',
        source: 'inferred'
      }
    ];

    expect(component.getRecurringYearlyTotal()).toBe(5544);
    expect(component.getRecurringMonthlyTotal()).toBe(462);
    expect(component.getRecurringDailyTotal()).toBe(22);
    expect(component.getRecurringFutureAllocation(component.filteredRecurringInvestments[0])).toBe(100);
  });

  it('calculates future allocation from annualized recurring buys', () => {
    const { component } = createComponent();
    component.filteredRecurringInvestments = [
      {
        symbol: 'AAPL',
        accountId: 'acc-1',
        accountName: 'Main Investing',
        amount: 50,
        currency: 'USD',
        frequency: 'monthly',
        confidence: 0.9,
        occurrences: 5,
        lastDate: '2026-05-01',
        source: 'inferred'
      },
      {
        symbol: 'BNDI',
        accountId: 'acc-1',
        accountName: 'Main Investing',
        amount: 25,
        currency: 'USD',
        frequency: 'monthly',
        confidence: 0.9,
        occurrences: 5,
        lastDate: '2026-05-01',
        source: 'inferred'
      }
    ];

    expect(component.getRecurringFutureAllocation(component.filteredRecurringInvestments[0])).toBeCloseTo(66.67, 2);
    expect(component.getRecurringFutureAllocation(component.filteredRecurringInvestments[1])).toBeCloseTo(33.33, 2);
    expect(component.getRecurringCurrentAllocation(component.filteredRecurringInvestments[0])).toBeCloseTo(54.55, 2);
    expect(component.getRecurringCurrentAllocation(component.filteredRecurringInvestments[1])).toBe(0);
  });

  it('edits and removes recurring buys in the account view', () => {
    const { component, snapTradeService } = createComponent();

    component.startRecurringEdit(0, component.filteredRecurringInvestments[0]);
    component.recurringEditDraft = { amount: 22, frequency: 'daily' };
    component.saveRecurringEdit(0);

    expect(snapTradeService.updateRecurringInvestmentPreference).toHaveBeenCalledWith({
      accountId: 'acc-1',
      symbol: 'AAPL',
      currency: 'USD',
      amount: 22,
      frequency: 'daily',
      hidden: false
    });
    expect(component.filteredRecurringInvestments[0].amount).toBe(22);
    expect(component.filteredRecurringInvestments[0].frequency).toBe('daily');
    expect(component.getRecurringYearlyTotal()).toBe(5544);

    component.removeRecurringInvestment(0);

    expect(snapTradeService.hideRecurringInvestmentPreference).toHaveBeenCalledWith({
      accountId: 'acc-1',
      symbol: 'AAPL',
      currency: 'USD'
    });
    expect(component.filteredRecurringInvestments).toEqual([]);
    expect(component.getRecurringYearlyTotal()).toBe(0);
  });

  it('clears manual recurring buy changes and reloads inferred rows', () => {
    const { component, snapTradeService } = createComponent();

    component.clearRecurringManualChanges();

    expect(snapTradeService.clearRecurringInvestmentPreferences).toHaveBeenCalledWith('acc-1');
    expect(snapTradeService.getRecurringInvestments).toHaveBeenLastCalledWith(true);
    expect(component.clearingRecurringChanges).toBe(false);
  });

  it('loads account balance history from saved account snapshots', () => {
    const { component, snapTradeService } = createComponent();

    expect(component.chartRanges.map(range => range.label)).toEqual(['1W', '1M', '3M', '1Y', '5Y', 'All']);
    expect(component.selectedRange.label).toBe('1M');
    expect(snapTradeService.getAccountSnapshots).toHaveBeenCalledWith('acc-1');
    expect(component.balanceHistory.map(point => point.close)).toEqual([800, 860]);
    expect(component.chartChange).toBe(60);
    expect(component.chartChangePercent).toBe(7.5);
  });

  it('filters loaded account balance history by the selected range', () => {
    const today = new Date();
    const stale = new Date();
    stale.setDate(today.getDate() - 45);
    const { component, snapTradeService } = createComponent('acc-1', [
      { snapshotDate: stale.toISOString().slice(0, 10), accountId: 'acc-1', totalBalance: 700, currency: 'USD' },
      { snapshotDate: today.toISOString().slice(0, 10), accountId: 'acc-1', totalBalance: 860, currency: 'USD' }
    ]);

    expect(component.balanceHistory.map(point => point.close)).toEqual([860]);
    expect(component.chartChange).toBe(0);
    expect(component.chartChangePercent).toBe(0);

    component.selectRange(component.chartRanges.find(range => range.label === 'All')!);

    expect(snapTradeService.getAccountSnapshots).toHaveBeenCalledTimes(1);
    expect(component.balanceHistory.map(point => point.close)).toEqual([700, 860]);
    expect(component.chartChange).toBe(160);
  });

  it('navigates to stock detail when a holding symbol is selected', () => {
    const { component, router } = createComponent();

    component.viewStock('AAPL');

    expect(router.navigate).toHaveBeenCalledWith(['/stock', 'AAPL']);
  });

  it('shows not found state for an unknown account id', () => {
    const { component } = createComponent('missing-account');

    expect(component.account).toBeNull();
    expect(component.notFound).toBe(true);
    expect(component.filteredRecurringInvestments).toEqual([]);
  });
});
