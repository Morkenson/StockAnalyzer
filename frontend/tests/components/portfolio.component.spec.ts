import { of } from 'rxjs';

import { PortfolioComponent } from '../../app/components/portfolio.component';
import { Portfolio } from '../../app/models/snaptrade.model';
import { SnapTradeService } from '../../app/services/snaptrade.service';

describe('PortfolioComponent overview', () => {
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
        holdings: [
          {
            id: 'holding-1',
            symbol: 'AAPL',
            quantity: 2,
            averagePurchasePrice: 100,
            currentPrice: 125,
            totalValue: 250,
            bookValue: 200,
            gainLoss: 50,
            gainLossPercent: 25,
            currency: 'USD'
          }
        ]
      },
      {
        id: 'acc-2',
        accountNumber: '002',
        name: 'IRA',
        type: 'CASH',
        brokerageId: 'broker-2',
        balance: 500,
        currency: 'USD',
        holdings: [
          {
            id: 'holding-2',
            symbol: 'MSFT',
            quantity: 1,
            averagePurchasePrice: 200,
            currentPrice: 220,
            totalValue: 220,
            bookValue: 200,
            gainLoss: 20,
            gainLossPercent: 10,
            currency: 'USD'
          }
        ]
      }
    ],
    totalBalance: 1500,
    totalGainLoss: 70,
    totalGainLossPercent: 4.9,
    currency: 'USD'
  };

  function createComponent() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const snapTradeService = {
      getPortfolio: jest.fn().mockReturnValue(of(portfolio)),
      getPortfolioSnapshots: jest.fn().mockReturnValue(of([
        {
          snapshotDate: yesterday.toISOString().slice(0, 10),
          totalBalance: 1400,
          totalGainLoss: 20,
          totalGainLossPercent: 1.45,
          accountCount: 2,
          currency: 'USD'
        },
        {
          snapshotDate: today.toISOString().slice(0, 10),
          totalBalance: 1500,
          totalGainLoss: 70,
          totalGainLossPercent: 4.9,
          accountCount: 2,
          currency: 'USD'
        }
      ])),
      getRecurringInvestments: jest.fn().mockReturnValue(of([
        {
          symbol: 'VOO',
          accountId: 'acc-1',
          accountName: 'Brokerage',
          amount: 100,
          currency: 'USD',
          frequency: 'weekly',
          confidence: 0.9,
          occurrences: 4,
          lastDate: today.toISOString().slice(0, 10),
          source: 'transactions'
        },
        {
          symbol: 'SCHD',
          accountId: 'acc-2',
          accountName: 'IRA',
          amount: 200,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.9,
          occurrences: 3,
          lastDate: today.toISOString().slice(0, 10),
          source: 'transactions'
        }
      ])),
      getDividendIncome: jest.fn().mockReturnValue(of({
        userId: 'user-1',
        lookbackDays: 365,
        totals: [{ currency: 'USD', annualIncome: 150, monthlyIncome: 12.5 }],
        accounts: [
          {
            accountId: 'acc-1',
            accountName: 'Brokerage',
            currency: 'USD',
            annualIncome: 96,
            monthlyIncome: 8,
            paymentCount: 4,
            lastPaymentDate: today.toISOString().slice(0, 10)
          },
          {
            accountId: 'acc-2',
            accountName: 'IRA',
            currency: 'USD',
            annualIncome: 54,
            monthlyIncome: 4.5,
            paymentCount: 2,
            lastPaymentDate: today.toISOString().slice(0, 10)
          }
        ],
        symbols: [],
        paymentCount: 4,
        source: 'transactions'
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

    return { component, snapTradeService, router };
  }

  it('loads the portfolio overview and saved balance snapshots', () => {
    const { component, snapTradeService } = createComponent();

    expect(component.portfolio?.totalBalance).toBe(1500);
    expect(snapTradeService.getPortfolio).toHaveBeenCalledWith(false);
    expect(snapTradeService.getPortfolioSnapshots).toHaveBeenCalled();
    expect(snapTradeService.getDividendIncome).toHaveBeenCalledWith(false);
    expect(snapTradeService.getRecurringInvestments).toHaveBeenCalledWith(false);
  });

  it('builds portfolio balance history from saved snapshots', () => {
    const { component } = createComponent();

    expect(component.chartRanges.map(range => range.label)).toEqual(['1W', '1M', '3M', '1Y', '5Y', 'All']);
    expect(component.selectedRange.label).toBe('1M');
    expect(component.balanceHistory.map(point => point.close)).toEqual([1400, 1500]);
    expect(component.chartChange).toBe(100);
    expect(component.chartChangePercent).toBeCloseTo(7.14, 2);
  });

  it('filters saved snapshots by range without refetching them', () => {
    const { component, snapTradeService } = createComponent();

    component.selectRange(component.chartRanges.find(range => range.label === '1Y')!);

    expect(snapTradeService.getPortfolioSnapshots).toHaveBeenCalledTimes(1);
    expect(component.balanceHistory.map(point => point.close)).toEqual([1400, 1500]);
  });

  it('refreshes only the portfolio overview with refresh=true', () => {
    const { component, snapTradeService } = createComponent();

    component.refreshPortfolio();

    expect(snapTradeService.getPortfolio).toHaveBeenLastCalledWith(true);
    expect(snapTradeService.getDividendIncome).toHaveBeenLastCalledWith(true);
    expect(snapTradeService.getRecurringInvestments).toHaveBeenLastCalledWith(true);
  });

  it('computes account card stats from holdings, dividends, and recurring buys', () => {
    const { component } = createComponent();
    const account = portfolio.accounts[0];

    expect(component.getAccountTotalGainLoss(account)).toBe(50);
    expect(component.getAccountTotalGainLossPercent(account)).toBe(25);
    expect(component.getPortfolioAllocation(account)).toBeCloseTo(16.67, 2);
    expect(component.getLargestHolding(account)?.symbol).toBe('AAPL');
    expect(component.getAccountDividendIncome(account)?.monthlyIncome).toBe(8);
    expect(component.getAccountMonthlyRecurringBuys(account)).toBeCloseTo(433.33, 2);
  });

  it('loads future estimates on demand from recurring buys and dividends', () => {
    const { component, snapTradeService } = createComponent();

    component.toggleFuture();

    expect(component.showFuture).toBe(true);
    expect(snapTradeService.getRecurringInvestments).toHaveBeenCalledWith(false);
    expect(snapTradeService.getDividendIncome).toHaveBeenCalledWith(false);
    expect(component.monthlyRecurringInvestment).toBeCloseTo(633.33, 2);
    expect(component.currentAnnualDividendIncome).toBe(150);
    expect(component.currentDividendYield).toBe(10);
    expect(component.futureProjections.find(projection => projection.label === '5 Years')?.value).toBe(39500);
    expect(component.futureProjections.find(projection => projection.label === '5 Years')?.monthlyIncome).toBeCloseTo(329.17, 2);
  });

  it('navigates to the dedicated account page', () => {
    const { component, router } = createComponent();

    component.viewAccount(portfolio.accounts[0]);

    expect(router.navigate).toHaveBeenCalledWith(['/portfolio/accounts', 'acc-1']);
  });

});
