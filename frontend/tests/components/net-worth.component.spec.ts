import { FormBuilder } from '@angular/forms';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';

import { NetWorthComponent } from '../../app/components/net-worth.component';
import { Asset } from '../../app/models/asset.model';
import { Loan } from '../../app/models/loan.model';
import { Portfolio } from '../../app/models/snaptrade.model';
import { AssetService } from '../../app/services/asset.service';
import { LoanService } from '../../app/services/loan.service';
import { SnapTradeService } from '../../app/services/snaptrade.service';

describe('NetWorthComponent', () => {
  const manualAssets: Asset[] = [
    {
      id: 'asset-1',
      name: 'Emergency Fund',
      assetType: 'Cash',
      value: 2500,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01')
    },
    {
      id: 'asset-2',
      name: 'House Equity',
      assetType: 'Real Estate',
      value: 5000,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01')
    }
  ];

  const savedLoans: Loan[] = [
    {
      id: 'loan-1',
      name: 'Car Loan',
      principal: 2000,
      interestRate: 6,
      loanTerm: 48,
      monthlyPayment: 47,
      totalAmountPaid: 2256,
      totalInterest: 256,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01')
    }
  ];

  const connectedPortfolio: Portfolio = {
    userId: 'user-1',
    accounts: [],
    totalBalance: 10000,
    totalGainLoss: 0,
    totalGainLossPercent: 0,
    currency: '$'
  };

  function createComponent(portfolio$: Observable<Portfolio>) {
    const assets$ = new BehaviorSubject<Asset[]>(manualAssets);
    const loans$ = new BehaviorSubject<Loan[]>(savedLoans);
    const assetService = {
      getAssets: jest.fn().mockReturnValue(assets$.asObservable()),
      createAsset: jest.fn(),
      deleteAsset: jest.fn()
    };
    const loanService = {
      getLoans: jest.fn().mockReturnValue(loans$.asObservable())
    };
    const snapTradeService = {
      getPortfolio: jest.fn().mockReturnValue(portfolio$)
    };
    const component = new NetWorthComponent(
      new FormBuilder(),
      assetService as unknown as AssetService,
      loanService as unknown as LoanService,
      snapTradeService as unknown as SnapTradeService
    );

    component.ngOnInit();

    return { component, assets$, loans$, snapTradeService };
  }

  it('adds connected portfolios and manual assets, then subtracts saved loan principal', () => {
    const { component } = createComponent(of(connectedPortfolio));

    expect(component.connectedPortfolioValue).toBe(10000);
    expect(component.totalAssetValue).toBe(7500);
    expect(component.totalDebtPrincipal).toBe(2000);
    expect(component.totalNetWorth).toBe(15500);

    component.ngOnDestroy();
  });

  it('uses zero connected portfolio value when no portfolio is available', () => {
    const { component } = createComponent(throwError(() => ({ status: 404 })));

    expect(component.connectedPortfolioValue).toBe(0);
    expect(component.portfolioError).toBe('');
    expect(component.totalNetWorth).toBe(5500);

    component.ngOnDestroy();
  });

  it('keeps manual assets and debt visible when connected portfolios fail', () => {
    const { component } = createComponent(throwError(() => ({ status: 500 })));

    expect(component.connectedPortfolioValue).toBe(0);
    expect(component.portfolioError).toContain('Connected portfolios are unavailable');
    expect(component.totalAssetValue).toBe(7500);
    expect(component.totalDebtPrincipal).toBe(2000);
    expect(component.totalNetWorth).toBe(5500);

    component.ngOnDestroy();
  });

  it('toggles the in-page debt calculator', () => {
    const { component } = createComponent(of(connectedPortfolio));

    expect(component.showDebtCalculator).toBe(false);

    component.toggleDebtCalculator();
    expect(component.showDebtCalculator).toBe(true);

    component.toggleDebtCalculator();
    expect(component.showDebtCalculator).toBe(false);

    component.ngOnDestroy();
  });
});
